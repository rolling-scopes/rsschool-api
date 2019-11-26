import axios from 'axios';
import getConfig from 'next/config';
import { Session } from '../components/withSession';
import { Event } from './event';
import { UserBasic, MentorBasic, StudentBasic } from '../../../common/models';

const { serverRuntimeConfig } = getConfig();

export interface CourseTask {
  id: number;
  courseTaskId?: number;
  taskId: number;
  name: string;
  maxScore: number | null;
  verification: 'auto' | 'manual';
  type: 'jstask' | 'htmltask' | 'externaltask' | 'test';
  githubRepoName: string;
  sourceGithubRepoUrl: string;
  scoreWeight: number;
  stageId: number;
  githubPrRequired: boolean;
  description: string | null;
  descriptionUrl: string | null;
  studentStartDate: string | null;
  studentEndDate: string | null;
  taskResultCount: number;
  useJury: boolean;
  checker: 'mentor' | 'assigned' | 'taskOwner';
  taskOwner: { id: number; githubId: string; name: string } | null;
}

export interface CourseEvent {
  id: number;
  event: Event;
  date: string;
  time: string;
  place: string;
  comment: string;
  stageId: number;
  eventId: number;
  owner: string;
  coordinator: string;
  organizerId: number;
  organizer: UserBasic;
  detailsUrl: string;
  broadcastUrl: string;
}

export interface CreateCourseTask {
  taskId: number;
  maxScore?: number;
  scoreWeight?: number;
  stageId: number;
}

export interface Course {
  id: number;
  name: string;
  fullName: string;
  alias: string;
  completed: boolean;
  inviteOnly: boolean;
  description: string;
  endDate: string;
  planned: boolean;
  primarySkillId: string;
  primarySkillName: string;
  startDate: string;
  registrationEndDate: string;
}

export interface MentorWithContacts {
  githubId: string;
  email: string;
  phone: string;
}

export class CourseService {
  private host = serverRuntimeConfig.rsHost || '';
  private urlPrefix: string;

  constructor(private courseId?: number) {
    this.urlPrefix = `/api/course/${this.courseId}`;
  }

  private wrapUrl = (url: string) => {
    return `${this.urlPrefix}${url}`;
  };

  async updateCourse(id: number, data: Partial<Course>) {
    type Response = { data: Course };
    const result = await axios.put<Response>(`/api/course/${id}`, data);
    return result.data.data;
  }

  async createCourse(data: Partial<Course>) {
    const result = await axios.post<{ data: Course }>(`${this.host}/api/course/`, data);
    return result.data.data;
  }

  async getCourses() {
    const result = await axios.get<{ data: Course[] }>(`${this.host}/api/courses`);
    return result.data.data;
  }

  async getCourseTasks() {
    type Response = { data: CourseTask[] };
    const result = await axios.get<Response>(this.wrapUrl('/tasks'));
    return result.data.data;
  }

  async getCourseTasksForTaskOwner(courseId: number) {
    const result = await axios.get<{ data: CourseTask[] }>(`${this.host}/api/course/${courseId}/tasksTaskOwner`);
    return result.data.data;
  }

  async getCourseEvents(courseId: number) {
    const result = await axios.get<{ data: CourseEvent[] }>(`${this.host}/api/course/${courseId}/events`);
    return result.data.data;
  }

  async createCourseEvent(courseId: number, data: Partial<CourseEvent>) {
    const result = await axios.post<{ data: CourseEvent }>(`/api/course/${courseId}/event`, data);
    return result.data.data;
  }

  async updateCourseEvent(courseId: number, courseTaskId: number, data: any) {
    const result = await axios.put<{ data: CourseEvent }>(
      `${this.host}/api/course/${courseId}/event/${courseTaskId}`,
      data,
    );
    return result.data.data;
  }

  async deleteCourseEvent(courseId: number, courseTaskId: number) {
    const result = await axios.delete(`/api/course/${courseId}/event/${courseTaskId}`);
    return result.data.data;
  }

  async getCourseStudents(courseId: number, activeOnly?: boolean) {
    const result = await axios.get<{ data: StudentDetails[] }>(
      `${this.host}/api/course/${courseId}/students?status=${activeOnly ? 'active' : 'all'}`,
    );
    return result.data.data;
  }

  async getCourseStudentsWithDetails(courseId: number) {
    const result = await axios.get<{ data: StudentDetails[] }>(`${this.host}/api/course/${courseId}/students/details`);
    return result.data.data;
  }

  async searchCourseStudent(courseId: number, query: string | null) {
    try {
      if (!query) {
        return [];
      }
      const response = await axios.get<{ data: StudentDetails[] }>(
        `${this.host}/api/course/${courseId}/students/search/${query}`,
      );
      return response.data.data;
    } catch (e) {
      return [];
    }
  }

  async getMentorsWithDetails() {
    type Response = { data: MentorDetails[] };
    const result = await axios.get<Response>(this.wrapUrl('/mentors/details'));
    return result.data.data;
  }

  async getCourseTasksWithTaskCheckers(courseId: number) {
    type Response = { data: CourseTask[] };
    const result = await axios.get<Response>(`${this.host}/api/course/${courseId}/tasksCheckers`);
    return result.data.data;
  }

  async createCourseTask(courseId: number, data: CreateCourseTask) {
    const result = await axios.post<{ data: CourseTask }>(`${this.host}/api/course/${courseId}/task`, data);
    return result.data.data;
  }

  async updateCourseTask(courseId: number, courseTaskId: number, data: any) {
    const result = await axios.put<{ data: CourseTask }>(
      `${this.host}/api/course/${courseId}/task/${courseTaskId}`,
      data,
    );
    return result.data.data;
  }

  async deleteCourseTask(courseId: number, courseTaskId: number) {
    const result = await axios.delete(`/api/course/${courseId}/task/${courseTaskId}`);
    return result.data.data;
  }

  async getCourseScore(courseId: number) {
    const result = await axios.get<{ data: StudentScore[] }>(`/api/course/${courseId}/students/score`);
    return result.data.data;
  }

  async postStudentScore(courseId: number, studentId: number, data: PostScore) {
    await axios.post(`/api/course/${courseId}/score`, {
      studentId,
      ...data,
    });
  }

  async postMultipleScores(courseId: number, courseTaskId: number, data: any) {
    const result = await axios.post(`/api/course/${courseId}/scores/${courseTaskId}`, data);
    return result.data.data;
  }

  async getAllMentorStudents(courseId: number) {
    const result = await axios.get<{ data: { students: StudentBasic[]; assignedStudents: AssignedStudent[] } }>(
      `/api/course/${courseId}/mentor/me/students/all`,
    );
    return result.data.data;
  }

  async getMentorStudents(courseId: number) {
    const result = await axios.get<{ data: StudentBasic[] }>(`/api/course/${courseId}/mentor/me/students`);
    return result.data.data;
  }

  async getInterviewStudents(courseId: number) {
    const result = await axios.get<{ data: StudentBasic[] }>(`/api/course/${courseId}/mentor/me/interviews`);
    return result.data.data;
  }

  async postPublicFeedback(courseId: number, data: { toUserId: number; badgeId?: string; comment: string }) {
    type Response = { data: { heroesUrl: string } };
    const result = await axios.post<Response>(`/api/course/${courseId}/feedback`, data);
    return result.data.data;
  }

  async expelStudent(githubId: string, comment: string = '') {
    await axios.post(this.wrapUrl(`/student/${githubId}/status`), { comment, status: 'expelled' });
  }

  async postTaskVerification(courseId: number, courseTaskId: number, data: any) {
    await axios.post(`/api/course/${courseId}/student/me/task/${courseTaskId}/verification`, data);
  }

  async getTaskVerifications(courseId: number) {
    const result = await axios.get(`/api/course/${courseId}/student/me/tasks/verifications`);
    return result.data.data;
  }

  async getStageInterviews(courseId: number, stageId: number) {
    const result = await axios.get(`/api/course/${courseId}/stage/${stageId}/interviews`);
    return result.data.data;
  }

  async getAvailableStudentsForStageInterviews(courseId: number, stageId: number) {
    const result = await axios.get(`/api/course/${courseId}/stage/${stageId}/interviews/available-students`);
    return result.data.data;
  }

  async createInterview(courseId: number, stageId: number, students: { githubId: string }[]) {
    const result = await axios.post(`/api/course/${courseId}/stage/${stageId}/interview`, students);
    return result.data.data;
  }

  async deleteInterview(courseId: number, stageId: number, interviewId: number) {
    const result = await axios.delete(`/api/course/${courseId}/stage/${stageId}/interview/${interviewId}`);
    return result.data.data;
  }

  async getStageInterviewStudents(courseId: number, stageId: number) {
    const result = await axios.get(`/api/course/${courseId}/stage/${stageId}/interviews/students`);
    return result.data.data as StudentBasic[];
  }

  async postStageInterviews(courseId: number, stageId: number) {
    const result = await axios.post(`/api/course/${courseId}/stage/${stageId}/interviews`);
    return result.data.data;
  }

  async postStageInterviewFeedback(courseId: number, stageId: number, data: any) {
    const result = await axios.post(`/api/course/${courseId}/stage/${stageId}/interviews/feedback`, data);
    return result.data.data;
  }

  async getStageInterviewFeedback(courseId: number, stageId: number, studentId: number) {
    const result = await axios.get(`/api/course/${courseId}/stage/${stageId}/interviews/student/${studentId}`);
    return result.data.data;
  }

  async getStageInterviewsByStudent(courseId: number, githubId: string) {
    const result = await axios.get(`/api/course/${courseId}/student/${githubId}/interviews`);
    return result.data.data;
  }

  async createRepository(githubId: string) {
    type Response = { data: { repository: string } };
    const result = await axios.post<Response>(this.wrapUrl(`/mentor/${githubId}/repository`));
    return result.data.data;
  }

  async createRepositories(courseId: number) {
    const result = await axios.post(`/api/course/${courseId}/repositories`);
    return result.data.data as { repository: string }[];
  }

  async expelMentor(githubId: string) {
    await axios.post(this.wrapUrl(`/mentor/${githubId}/status/expelled`));
  }

  isPowerUser(courseId: number, session: Session) {
    return session.isAdmin || session.roles[courseId] === 'coursemanager';
  }
}

export interface StudentProfile {
  courseId: number;
  totalScore: number;
  mentor: MentorWithContacts | null;
}

export interface AssignedStudent extends StudentBasic {
  courseTaskId: number;
}

export interface StudentScore extends StudentBasic {
  taskResults: {
    courseTaskId: number;
    score: number;
  }[];
  rank: number;
  locationName: string;
  totalScore: number;
}

export interface StudentDetails extends StudentBasic {
  countryName: string;
  locationName: string;
  totalScore: number;
  repository: string;
  interviews: { id: number; isCompleted: boolean }[];
}

export interface MentorDetails extends MentorBasic {
  countryName: string;
  locationName: string;
  maxStudentsLimit: number;
  interviewsCount: number;
}

export interface PostScore {
  courseTaskId: number;
  score: number;
  comment?: string;
  githubPrUrl?: string;
}
