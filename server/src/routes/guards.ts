import Router from '@koa/router';
import { config } from '../config';
import { IUserSession, CourseRole } from '../models';
const auth = require('koa-basic-auth'); //tslint:disable-line

const basicAuthAdmin = auth({ name: config.admin.username, pass: config.admin.password });
export const basicAuthAws = auth({
  name: config.users.verification.username,
  pass: config.users.verification.password,
});

const userGuards = (user: IUserSession) => {
  const courses = Object.keys(user.coursesRoles ?? {});
  const guards = {
    isAdmin: () => user.isAdmin,
    isHirer: () => user.isHirer,
    hasRole: (courseId: number) => !!user.roles[courseId] || (user.coursesRoles?.[courseId] ?? false),
    isAnyManager: () => courses.some((courseId: string) => user.coursesRoles?.[courseId]?.includes(CourseRole.manager)),
    isAnySupervisor: () =>
      courses.some((courseId: string) => user.coursesRoles?.[courseId]?.includes(CourseRole.supervisor)),
    isManager: (courseId: number) => user.coursesRoles?.[courseId]?.includes(CourseRole.manager) ?? false,
    isMentor: (courseId: number) => user.roles[courseId] === 'mentor',
    isAnyMentor: () => Object.keys(user.roles).some((role: string) => user.roles[role].includes('mentor')),
    isStudent: (courseId: number) => user.roles[courseId] === 'student',
    isTaskOwner: (courseId: number) => user.coursesRoles?.[courseId]?.includes(CourseRole.taskOwner) ?? false,
    isLoggedIn: (ctx: Router.RouterContext<any, any>) => user != null && (ctx.isAuthenticated() || config.isDevMode),
    isSupervisor: (courseId: number) => user.coursesRoles?.[courseId]?.includes(CourseRole.supervisor) ?? false,
  };
  return {
    ...guards,
    isPowerUser: (courseId: number) => guards.isAdmin() || guards.isManager(courseId),
  };
};

export const guard = async (ctx: Router.RouterContext<any, any>, next: () => Promise<void>) => {
  const user = ctx.state.user as IUserSession;
  const guards = userGuards(user);
  if (guards.isLoggedIn(ctx)) {
    await next();
    return;
  }
  await basicAuthAdmin(ctx, next);
};

export const courseGuard = async (ctx: Router.RouterContext<any, any>, next: () => Promise<void>) => {
  const user = ctx.state.user as IUserSession;
  const guards = userGuards(user);
  ctx.params.courseId = Number(ctx.params.courseId);
  const { courseId } = ctx.params;

  if (guards.isLoggedIn(ctx) && (guards.hasRole(courseId) || guards.isPowerUser(courseId))) {
    await next();
    return;
  }
  await basicAuthAdmin(ctx, next);
};

export const courseMentorGuard = async (ctx: Router.RouterContext<any, any>, next: () => Promise<void>) => {
  const user = ctx.state.user as IUserSession;
  const guards = userGuards(user);
  ctx.params.courseId = Number(ctx.params.courseId);
  const { courseId } = ctx.params;

  if (
    guards.isLoggedIn(ctx) &&
    (guards.isMentor(courseId) || guards.isSupervisor(courseId) || guards.isPowerUser(courseId))
  ) {
    await next();
    return;
  }
  await basicAuthAdmin(ctx, next);
};

export const anyCourseMentorGuard = async (ctx: Router.RouterContext, next: () => Promise<void>) => {
  const user = ctx.state.user as IUserSession;
  const guards = userGuards(user);

  if (guards.isLoggedIn(ctx) && guards.isAnyMentor()) {
    await next();
    return;
  }
  await basicAuthAdmin(ctx, next);
};

export const adminGuard = async (ctx: Router.RouterContext, next: () => Promise<void>) => {
  const user = ctx.state.user as IUserSession;
  const guards = userGuards(user);

  if (guards.isLoggedIn(ctx) && guards.isAdmin()) {
    await next();
    return;
  }
  await basicAuthAdmin(ctx, next);
};

export const taskOwnerGuard = async (ctx: Router.RouterContext<any, any>, next: () => Promise<void>) => {
  const user = ctx.state.user as IUserSession;
  const guards = userGuards(user);
  ctx.params.courseId = Number(ctx.params.courseId);
  const { courseId } = ctx.params;
  if (
    guards.isLoggedIn(ctx) &&
    (guards.isTaskOwner(courseId) || guards.isMentor(courseId) || guards.isPowerUser(courseId))
  ) {
    await next();
    return;
  }
  await basicAuthAdmin(ctx, next);
};

export const courseManagerGuard = async (ctx: Router.RouterContext<any, any>, next: () => Promise<void>) => {
  const user = ctx.state.user as IUserSession;
  const guards = userGuards(user);
  ctx.params.courseId = Number(ctx.params.courseId);
  const { courseId } = ctx.params;
  if (guards.isLoggedIn(ctx) && guards.isPowerUser(courseId)) {
    await next();
    return;
  }
  await basicAuthAdmin(ctx, next);
};

export const anyCourseManagerGuard = async (ctx: Router.RouterContext<any, any>, next: () => Promise<void>) => {
  const user = ctx.state.user as IUserSession;
  const guards = userGuards(user);
  if (guards.isLoggedIn(ctx) && (guards.isAnyManager() || guards.isAdmin())) {
    await next();
    return;
  }
  await basicAuthAdmin(ctx, next);
};

export const anyCoursePowerUserGuard = async (ctx: Router.RouterContext<any, any>, next: () => Promise<void>) => {
  const user = ctx.state.user as IUserSession;
  const guards = userGuards(user);
  if (guards.isLoggedIn(ctx) && (guards.isAnyManager() || guards.isAnySupervisor() || guards.isAdmin())) {
    await next();
    return;
  }
  await basicAuthAdmin(ctx, next);
};

export const courseSupervisorGuard = async (ctx: Router.RouterContext<any, any>, next: () => Promise<void>) => {
  const user = ctx.state.user as IUserSession;
  const guards = userGuards(user);
  const { courseId } = ctx.params;
  if (guards.isLoggedIn(ctx) && (guards.isPowerUser(courseId) || guards.isSupervisor(courseId))) {
    await next();
    return;
  }
  await basicAuthAdmin(ctx, next);
};
