import _ from 'lodash';
import { getRepository } from 'typeorm';
import { MentorBasic, StudentBasic } from '../../../common/models';
import { Course, CourseTask, Mentor, StageInterview, Student, User, CourseEvent } from '../models';
import { IUserSession } from '../models/session';
import cities from './reference-data/cities.json';
import countries from './reference-data/countries.json';

const getPrimaryUserFields = (modelName: string = 'user') => [
  `${modelName}.id`,
  `${modelName}.firstName`,
  `${modelName}.lastName`,
  `${modelName}.githubId`,
  `${modelName}.locationName`,
];

const citiesMap = _.mapValues(_.keyBy(cities, 'name'), 'parentId');
const countriesMap = _.mapValues(_.keyBy(countries, 'id'), 'name');

export async function getCourseMentor(courseId: number, userId: number): Promise<{ id: number } | undefined> {
  return await getRepository(Mentor)
    .createQueryBuilder('mentor')
    .where('mentor."courseId" = :courseId AND mentor."userId" = :userId', { userId, courseId })
    .getOne();
}

export interface MentorWithContacts extends MentorBasic {
  email?: string;
  phone?: string;
}

export interface AssignedStudent extends StudentBasic {
  courseTaskId: number | null;
}

export interface StudentDetails extends StudentBasic {
  locationName: string | null;
  countryName: string;
  interviews: { id: number; isCompleted: boolean }[];
  repository: string;
}

export interface StudentWithResults extends StudentBasic {
  rank: number;
  locationName: string;
  taskResults: {
    courseTaskId: number;
    score: number;
  }[];
}

export interface MentorDetails extends MentorBasic {
  locationName: string | null;
  countryName: string;
  maxStudentsLimit: number;
  studentsPreference: 'sameCity' | 'sameCountry' | null;
  interviewsCount?: number;
  studentsCount?: number;
  taskResultsStats?: {
    total: number;
    checked: number;
  };
}

export function convertToMentorBasic(mentor: Mentor): MentorBasic {
  const user = (mentor.user as User)!;
  return {
    isActive: !mentor.isExpelled,
    name: `${user.firstName} ${user.lastName}`.trim(),
    id: mentor.id,
    githubId: user.githubId,
    students: mentor.students ? mentor.students.filter(s => !s.isExpelled && !s.isFailed).map(s => ({ id: s.id })) : [],
  };
}

export function convertToStudentBasic(student: Student): StudentBasic {
  const user = (student.user as User)!;
  return {
    name: `${user.firstName} ${user.lastName}`.trim(),
    isActive: !student.isExpelled && !student.isFailed,
    id: student.id,
    githubId: user.githubId,
    mentor: student.mentor ? convertToMentorBasic(student.mentor) : null,
    totalScore: student.totalScore,
  };
}

export function convertToStudentDetails(student: Student): StudentDetails {
  const studentBasic = convertToStudentBasic(student);
  const user = (student.user as User)!;
  return {
    ...studentBasic,
    locationName: user.locationName || null,
    countryName: countriesMap[citiesMap[user.locationName!]] || 'Other',
    interviews: _.isEmpty(student.stageInterviews) ? [] : student.stageInterviews!,
    repository: student.repository,
  };
}

export function convertToMentorDetails(mentor: Mentor): MentorDetails {
  const mentorBasic = convertToMentorBasic(mentor);
  const user = (mentor.user as User)!;
  return {
    ...mentorBasic,
    students: mentor.students ?? [],
    locationName: user.locationName || null,
    countryName: countriesMap[citiesMap[user.locationName!]] || 'Other',
    maxStudentsLimit: mentor.maxStudentsLimit,
    studentsPreference: mentor.studentsPreference,
    studentsCount: mentor.students ? mentor.students.length : 0,
    interviewsCount: mentor.stageInterviews ? mentor.stageInterviews.length : 0,
  };
}

function mentorQuery() {
  return getRepository(Mentor).createQueryBuilder('mentor');
}

function userQuery() {
  return getRepository(User).createQueryBuilder('user');
}

function studentQuery() {
  return getRepository(Student).createQueryBuilder('student');
}

export async function getCourses() {
  const records = await getRepository(Course)
    .createQueryBuilder('course')
    .where('course.completed = false')
    .getMany();
  return records;
}

export async function getMentorByUserId(courseId: number, userId: number): Promise<{ id: number } | null> {
  const record = await mentorQuery()
    .where('mentor."userId" = :userId', { userId })
    .andWhere('mentor."courseId" = :courseId', { courseId })
    .getOne();
  return record ?? null;
}

export async function expelMentor(courseId: number, githubId: string) {
  const githubIdQuery = userQuery()
    .select('id')
    .where('user.githubId = :githubId', { githubId })
    .getQuery();
  return mentorQuery()
    .update(Mentor)
    .set({ isExpelled: true })
    .where(`userId IN (${githubIdQuery})`, { githubId })
    .andWhere('mentor."courseId" = :courseId', { courseId })
    .execute();
}

export async function getMentorByGithubId(courseId: number, githubId: string): Promise<MentorBasic> {
  const record = await mentorQuery()
    .innerJoin('mentor.user', 'user')
    .addSelect(getPrimaryUserFields())
    .where('user.githubId = :githubId', { githubId })
    .andWhere('mentor."courseId" = :courseId', { courseId })
    .getOne();
  return convertToMentorBasic(record!);
}

export async function getStudentByGithubId(courseId: number, githubId: string): Promise<{ id: number }> {
  const record = (await queryStudentByGithubId(courseId, githubId))!;
  return record;
}

export async function queryStudentByGithubId(courseId: number, githubId: string): Promise<Student> {
  const record = (await studentQuery()
    .innerJoin('student.user', 'user')
    .where('user.githubId = :githubId', { githubId })
    .andWhere('student.courseId = :courseId', { courseId })
    .getOne())!;
  return record;
}

export async function getStudent(studentId: number): Promise<StudentBasic> {
  const record = (await studentQuery()
    .innerJoinAndSelect('student.user', 'user')
    .leftJoinAndSelect('student.mentor', 'mentor')
    .leftJoinAndSelect('mentor.user', 'mentorUser')
    .where('"student".id = :studentId', { studentId })
    .getOne())!;
  const student = convertToStudentBasic(record);
  student.mentor = record.mentor ? convertToMentorBasic(record.mentor) : null;
  return student;
}

export async function getStudentByUserId(courseId: number, userId: number): Promise<StudentBasic | null> {
  const record = await studentQuery()
    .innerJoinAndSelect('student.course', 'course')
    .innerJoinAndSelect('student.user', 'user')
    .innerJoinAndSelect('student.mentor', 'mentor')
    .innerJoinAndSelect('mentor.user', 'mentorUser')
    .where('user.id = :userId AND course.id = :courseId', {
      userId,
      courseId,
    })
    .getOne();
  if (record == null) {
    return null;
  }
  const student = convertToStudentBasic(record);
  student.mentor = record.mentor ? convertToMentorBasic(record.mentor) : null;
  return student;
}

export async function getStudentsByMentorId(mentorId: number) {
  const records = await studentQuery()
    .innerJoin('student.user', 'user')
    .addSelect(getPrimaryUserFields())
    .innerJoinAndSelect('student.mentor', 'mentor')
    .innerJoin('mentor.user', 'mentorUser')
    .addSelect(getPrimaryUserFields('mentorUser'))
    .where('"student"."mentorId" = :mentorId', { mentorId })
    .andWhere('"student"."isExpelled" = false')
    .getMany();

  const students = records.map(record => {
    const student = convertToStudentBasic(record);
    student.mentor = record.mentor ? convertToMentorBasic(record.mentor) : null;
    return student;
  });

  return students;
}

export async function getInterviewStudentsByMentorId(mentorId: number) {
  const records = await getRepository(StageInterview)
    .createQueryBuilder('stageInterview')
    .innerJoinAndSelect('stageInterview.mentor', 'mentor')
    .innerJoinAndSelect('stageInterview.student', 'student')
    .innerJoinAndSelect('student.user', 'studentUser')
    .where('stageInterview.mentorId = :mentorId', { mentorId })
    .getMany();

  const students = records.map(record => convertToStudentBasic(record.student));
  return students;
}

export async function getAssignedStudentsByMentorId(mentorId: number) {
  const records = await studentQuery()
    .innerJoin('student.user', 'user')
    .addSelect(getPrimaryUserFields())
    .innerJoinAndSelect('student.taskChecker', 'taskChecker')
    .innerJoinAndSelect('student.mentor', 'mentor')
    .innerJoin('mentor.user', 'mentorUser')
    .addSelect(getPrimaryUserFields('mentorUser'))
    .where('"taskChecker"."mentorId" = :mentorId', { mentorId })
    .andWhere('"student"."isExpelled" = false')
    .getMany();

  const students = records.map<AssignedStudent>(record => {
    const student = convertToStudentBasic(record);
    student.mentor = record.mentor ? convertToMentorBasic(record.mentor) : null;

    const [taskChecker] = record.taskChecker || [null];
    return {
      ...student,
      courseTaskId: taskChecker ? taskChecker.courseTaskId : null,
    };
  });

  return students;
}

export async function getMentors(courseId: number): Promise<MentorDetails[]> {
  const records = await mentorQuery()
    .innerJoin('mentor.user', 'user')
    .addSelect(getPrimaryUserFields())
    .innerJoin('mentor.course', 'course')
    .leftJoin('mentor.students', 'students')
    .addSelect(['students.id'])
    .leftJoinAndSelect('mentor.stageInterviews', 'stageInterviews')
    .where(`course.id = :courseId`, { courseId })
    .orderBy('mentor.createdDate')
    .getMany();

  const mentors = records.map(convertToMentorDetails);
  return mentors;
}

export async function getMentorsDetails(courseId: number): Promise<MentorDetails[]> {
  const courseTasks = await getRepository(CourseTask)
    .createQueryBuilder('courseTask')
    .leftJoin('courseTask.task', 'task')
    .leftJoin('courseTask.stage', 'stage')
    .where('task.verification = :manual', { manual: 'manual' })
    .andWhere('"courseTask".checker = :mentor', { mentor: 'mentor' })
    .andWhere('stage."courseId" = :courseId', { courseId })
    .andWhere('"courseTask"."studentEndDate" < NOW()')
    .getMany();
  const count = courseTasks.length;

  const records = await mentorQuery()
    .innerJoin('mentor.user', 'user')
    .addSelect(getPrimaryUserFields())
    .leftJoin('mentor.students', 'students')
    .addSelect(['students.id'])
    .leftJoin('students.taskResults', 'taskResults')
    .leftJoin('taskResults.courseTask', 'courseTask')
    .leftJoin('courseTask.task', 'task')
    .addSelect(['taskResults.id', 'taskResults.score', 'taskResults.courseTaskId'])
    .where(`"mentor"."courseId" = :courseId`, { courseId })
    .andWhere('task.verification = :manual', { manual: 'manual' })
    .andWhere('"courseTask".checker = :mentor', { mentor: 'mentor' })
    .orderBy('mentor.createdDate')
    .getMany();

  const mentors = records.map(mentor => {
    const mentorBasic = convertToMentorBasic(mentor);
    const user = (mentor.user as User)!;
    const totalToCheck = (mentor.students?.length ?? 0) * count;
    return {
      ...mentorBasic,
      locationName: user.locationName || null,
      countryName: countriesMap[citiesMap[user.locationName!]] || 'Other',
      maxStudentsLimit: mentor.maxStudentsLimit,
      studentsPreference: mentor.studentsPreference,
      studentsCount: mentor.students ? mentor.students.length : 0,
      interviewsCount: mentor.stageInterviews ? mentor.stageInterviews.length : 0,
      taskResultsStats: {
        total: totalToCheck,
        checked: mentor.students?.reduce((acc, student) => acc + (student.taskResults?.length ?? 0), 0) ?? 0,
      },
    };
  });
  return mentors;
}

export async function getMentorsWithStudents(courseId: number): Promise<MentorDetails[]> {
  const records = await mentorQuery()
    .innerJoin('mentor.user', 'user')
    .addSelect(getPrimaryUserFields())
    .innerJoin('mentor.course', 'course')
    .leftJoinAndSelect('mentor.students', 'students')
    .where(`course.id = :courseId`, { courseId })
    .orderBy('mentor.createdDate')
    .getMany();

  const mentors = records.map(convertToMentorDetails);
  return mentors;
}

export async function getMentorWithContacts(mentorId: number): Promise<MentorWithContacts> {
  const record = (await mentorQuery()
    .innerJoinAndSelect('mentor.user', 'user')
    .where('mentor.id = :mentorId', { mentorId })
    .getOne())!;
  const mentor = convertToMentorBasic(record);
  const mentorWithContacts: MentorWithContacts = {
    ...mentor,
    email: (record.user as User).contactsEmail,
    phone: (record.user as User).contactsPhone,
  };
  return mentorWithContacts;
}

export async function getStudentsWithDetails(courseId: number) {
  const records = await studentQuery()
    .innerJoin('student.user', 'user')
    .addSelect(getPrimaryUserFields())
    .innerJoin('student.course', 'course')
    .leftJoinAndSelect('student.mentor', 'mentor')
    .leftJoin('mentor.user', 'mentorUser')
    .leftJoin('student.stageInterviews', 'stageInterviews')
    .addSelect(getPrimaryUserFields('mentorUser'))
    .addSelect(['stageInterviews.id', 'stageInterviews.isCompleted'])
    .where(`course.id = :courseId`, { courseId })
    .orderBy('student.totalScore', 'DESC')
    .getMany();

  const students = records.map(convertToStudentDetails);
  return students;
}

export async function getStudents(courseId: number, activeOnly: boolean) {
  const records = await studentQuery()
    .innerJoin('student.user', 'user')
    .addSelect(getPrimaryUserFields())
    .innerJoin('student.course', 'course')
    .leftJoinAndSelect('student.mentor', 'mentor')
    .leftJoin('mentor.user', 'mentorUser')
    .addSelect(getPrimaryUserFields('mentorUser'))
    .where(`course.id = :courseId ${activeOnly ? 'AND student."isExpelled" = false' : ''}`, { courseId })
    .orderBy('student.totalScore', 'DESC')
    .getMany();

  const students = records.map(convertToStudentDetails);
  return students;
}

export async function getScoreStudents(courseId: number) {
  const students = await getRepository(Student)
    .createQueryBuilder('student')
    .innerJoin('student.user', 'user')
    .addSelect(getPrimaryUserFields().concat(['user.locationName']))
    .leftJoinAndSelect('student.mentor', 'mentor')
    .leftJoinAndSelect('student.taskResults', 'taskResults')
    .leftJoinAndSelect('student.taskInterviewResults', 'taskInterviewResults')
    .leftJoin('mentor.user', 'mentorUser')
    .addSelect(getPrimaryUserFields('mentorUser'))
    .innerJoin('student.course', 'course')
    .where('course.id = :courseId', { courseId })
    .getMany();

  return students
    .sort((a, b) => b.totalScore - a.totalScore)
    .map<StudentWithResults>((student, i) => {
      const user = student.user as User;
      const taskResults =
        student.taskResults
          ?.map(({ courseTaskId, score }) => ({ courseTaskId, score }))
          .concat(
            student.taskInterviewResults?.map(({ courseTaskId, score = 0 }) => ({
              courseTaskId,
              score,
            })) ?? [],
          ) ?? [];

      return {
        rank: i + 1,
        courseId,
        id: student.id,
        mentor: student.mentor ? convertToMentorBasic(student.mentor) : null,
        userId: user.id!,
        name: `${user.firstName} ${user.lastName}`.trim(),
        githubId: user.githubId,
        totalScore: student.totalScore,
        locationName: user.locationName ?? '',
        taskResults,
        isActive: !student.isExpelled && !student.isFailed,
      };
    });
}

export async function getCourseTasks(courseId: number) {
  const courseTasks = await getRepository(CourseTask)
    .createQueryBuilder('courseTask')
    .innerJoinAndSelect('courseTask.task', 'task')
    .innerJoin('courseTask.stage', 'stage')
    .where('stage.courseId = :courseId', { courseId })
    .getMany();
  return courseTasks;
}

export async function updateScoreStudents(data: { id: number; totalScore: number }[]) {
  const result = await getRepository(Student).save(data);
  return result;
}

export function isPowerUser(courseId: number, session: IUserSession) {
  return session.isAdmin || session.roles[courseId] === 'coursemanager';
}

export async function getEvents(courseId: number) {
  return getRepository(CourseEvent)
    .createQueryBuilder('courseEvent')
    .innerJoinAndSelect('courseEvent.event', 'event')
    .innerJoin('courseEvent.stage', 'stage')
    .leftJoin('courseEvent.organizer', 'organizer')
    .addSelect([
      'stage.id',
      'stage.name',
      'organizer.id',
      'organizer.firstName',
      'organizer.lastName',
      'organizer.githubId',
    ])
    .where('courseEvent.courseId = :courseId', { courseId })
    .orderBy('courseEvent.date')
    .getMany();
}
