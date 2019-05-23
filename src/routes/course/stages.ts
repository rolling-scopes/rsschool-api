import * as Router from 'koa-router';
import { OK } from 'http-status-codes';
import { Stage } from '../../models';
import { ILogger } from '../../logger';
import { getRepository } from 'typeorm';
import { setResponse } from '../utils';
import { shuffleService } from '../../services';

export const getCourseStages = (_: ILogger) => async (ctx: Router.RouterContext) => {
  const courseId: number = ctx.params.courseId;
  const stages = await getRepository(Stage)
    .createQueryBuilder('stage')
    .where('stage."courseId" = :courseId ', { courseId })
    .getMany();
  setResponse(ctx, OK, stages);
};

export const postCloseStage = (logger: ILogger) => async (ctx: Router.RouterContext) => {
    const stageId: number = ctx.params.stageId;
    const courseId: number = ctx.params.courseId;

    logger.info(`StageId ${stageId}`);
    logger.info(`CourseId ${courseId}`);

    const mentorIdsNext = await shuffleService.shuffleMentors(courseId);

    setResponse(ctx, OK, { mentorIdsNext });
};
