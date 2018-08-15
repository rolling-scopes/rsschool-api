import * as Router from 'koa-router';
import { TaskModel } from '../../models/event';
import { createGetRoute, createPostRoute, createPatchRoute, createDeleteRoute } from '../generic';
import generateAssignemts from './generateAssignmets';

export function taskRouter(adminGuard: Router.IMiddleware) {
    const router = new Router({ prefix: '/task' });

    router.get('/:id', createGetRoute(TaskModel));
    router.post('/', adminGuard, createPostRoute(generateAssignemts(TaskModel)));
    router.patch('/', adminGuard, createPatchRoute(TaskModel));
    router.delete('/:id', adminGuard, createDeleteRoute(TaskModel));

    return router;
}
