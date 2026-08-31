import { Router } from 'express';
import * as usersController from './users.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';

const router = Router();

router.use(requireAuth);

router.get('/roles', requirePermission('users:read'), usersController.listRoles);
router.get('/', requirePermission('users:read'), usersController.listUsers);
router.get('/:id', requirePermission('users:read'), usersController.getUser);
router.post('/', requirePermission('users:write'), usersController.createUser);
router.put('/:id', requirePermission('users:write'), usersController.updateUser);
router.delete('/:id', requirePermission('users:delete'), usersController.deleteUser);

export default router;
