import Router from '@koa/router';
import { getCustomRepository, getRepository } from 'typeorm';
import axios from 'axios';
import { OK, BAD_REQUEST } from 'http-status-codes';
import { ILogger } from '../../logger';
import { Student } from '../../models';
import { setResponse } from '../utils';
import { config } from '../../config';
import { StudentRepository } from '../../repositories/student';

export const postCertificates = (_: ILogger) => async (ctx: Router.RouterContext) => {
  const courseId: number = ctx.params.courseId;
  const data: {
    criteria: { courseTaskIds?: number[]; minScore?: number; minTotalScore: number };
  } = ctx.request.body;

  if (data == null) {
    setResponse(ctx, BAD_REQUEST);
    return;
  }

  const studentRepository = getCustomRepository(StudentRepository);
  const studentIds = await studentRepository.findByCriteria(courseId, {
    courseTaskIds: data.criteria.courseTaskIds ?? [],
    minScore: data.criteria.minScore != null ? Number(data.criteria.minScore) : null,
    minTotalScore: data.criteria.minTotalScore != null ? Number(data.criteria.minTotalScore) : null,
  });

  let students: Student[] = [];
  const initialQuery = getRepository(Student)
    .createQueryBuilder('student')
    .innerJoin('student.course', 'course')
    .innerJoin('student.user', 'user')
    .addSelect([
      'user.id',
      'user.firstName',
      'user.lastName',
      'user.githubId',
      'course.name',
      'course.primarySkillName',
    ]);
  if (Array.isArray(studentIds) && studentIds.length > 0) {
    students = await initialQuery.where('student."id" IN (:...ids)', { ids: studentIds }).getMany();
  } else {
    students = await initialQuery
      .leftJoinAndSelect('student.certificate', 'certificate')
      .where(
        [
          'certificate.id IS NULL',
          'student."courseId" = :courseId',
          'student."isExpelled" = false',
          'student."isFailed" = false',
        ].join(' AND '),
        {
          courseId,
        },
      )
      .getMany();
  }

  const result = students.map(student => {
    const course = student.course!;
    const user = student.user!;
    return {
      courseId,
      courseName: course.name,
      coursePrimarySkill: course.primarySkillName,
      studentId: student.id,
      studentName: `${user.firstName} ${user.lastName}`,
      timestamp: Date.now(),
    };
  });
  await axios.post(`${config.aws.restApiUrl}/certificate`, result, {
    headers: { 'x-api-key': config.aws.restApiKey },
  });
  setResponse(ctx, OK, result);
};

export const postStudentCertificate = (_: ILogger) => async (ctx: Router.RouterContext) => {
  const { courseId, githubId } = ctx.params;
  const student = await getRepository(Student)
    .createQueryBuilder('student')
    .innerJoin('student.course', 'course')
    .innerJoin('student.user', 'user')
    .addSelect([
      'user.id',
      'user.firstName',
      'user.lastName',
      'user.githubId',
      'course.name',
      'course.primarySkillName',
    ])
    .where('student."courseId" = :courseId', { courseId })
    .andWhere('"user"."githubId" = :githubId', { githubId })
    .getOne();

  if (student == null) {
    setResponse(ctx, BAD_REQUEST, { message: 'No student' });
    return;
  }
  const result = {
    courseId,
    courseName: student.course.name,
    coursePrimarySkill: student.course.primarySkillName,
    studentId: student.id,
    studentName: `${student.user.firstName} ${student.user.lastName}`,
    timestamp: Date.now(),
  };
  await axios.post(`${config.aws.restApiUrl}/certificate`, result, {
    headers: { 'x-api-key': config.aws.restApiKey },
  });
  setResponse(ctx, OK, result);
};
