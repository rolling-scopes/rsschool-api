import * as Router from 'koa-router';
import { getRepository } from 'typeorm';
import { User, Mentor, Student, CourseTask } from '../../models';

import { NOT_FOUND, OK } from 'http-status-codes';
import { ILogger } from '../../logger';
import { setResponse } from '../utils';

export const getProfile = (_: ILogger) => async (ctx: Router.RouterContext) => {
  const query = ctx.query as { githubId: string | undefined };

  if (query === undefined) {
    setResponse(ctx, NOT_FOUND);
    return;
  }

  if (query.githubId === undefined) {
    setResponse(ctx, NOT_FOUND);
    return;
  }

  const githubId = query.githubId.toLowerCase();
  await getProfileByGithubId(ctx, githubId);
};

export const getProfileByGithubId = async (ctx: Router.RouterContext, githubId: string) => {
  const profile = await getRepository(User).findOne({
    where: { githubId },
    relations: [
      'receivedFeedback',
      'mentors',
      'students',
      'mentors.course',
      'students.course',
      'students.mentor',
      'students.taskResults',
      'students.feedback',
    ],
  });

  if (profile === undefined) {
    setResponse(ctx, NOT_FOUND);
    return;
  }

  const { students, mentors } = profile;

  if (students) {
    const studentsMentor = await Promise.all(
      students
        .filter(s => !!s.mentor)
        .map(s => getRepository(Mentor).findOne({ where: { id: s.mentor.id }, relations: ['user'] })),
    );

    const studentTasks = await Promise.all(
      students
        .filter(s => !!s.mentor)
        .map(s => s.taskResults || [])
        .reduce((acc, v) => acc.concat(v), [])
        .map(s => getRepository(CourseTask).findOne({ where: { id: s.courseTaskId }, relations: ['task'] })),
    );

    profile.students = (students
      .filter(s => !!s.mentor)
      .map(st => ({
        ...st,
        taskResults: (st.taskResults || []).map(t => ({
          ...t,
          ...studentTasks.find((st: any) => st.id === t.courseTaskId),
        })),
        mentor: studentsMentor.find((m: any) => m.id === st.mentor.id),
      })) as unknown) as Student[];
  }

  if (mentors) {
    const mentorForStudentIds = await Promise.all(
      mentors.map(m => getRepository(Mentor).findOne({ where: { id: m.id }, relations: ['students'] })),
    );

    const mentorForStudents = await Promise.all(
      mentorForStudentIds
        .map((m: any) => {
          return m.students.map((s: any) =>
            getRepository(Student).findOne({ where: { id: s.id }, relations: ['user'] }),
          );
        })
        .reduce((acc, v) => acc.concat(v), []),
    );

    const mfS = mentorForStudentIds.map((m: any) => ({
      ...m,
      students: m.students.map((st: any) => mentorForStudents.find((s: any) => st.id === s.id)),
    }));

    profile.mentors = (mentors.map(m => ({
      ...m,
      ...mfS.find((st: any) => st.id === m.id),
    })) as unknown) as Mentor[];
  }

  setResponse(ctx, OK, profile);
};
