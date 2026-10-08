import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import {
  createEmployeeController,
  listEmployeesController,
  getEmployeeByIdController,
  updateEmployeeController,
  deleteEmployeeController,
} from './employees.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listEmployeesController);
router.get('/:id', getEmployeeByIdController);
router.post('/', createEmployeeController);
router.put('/:id', updateEmployeeController);
router.delete('/:id', deleteEmployeeController);

export { router as employeesRouter };
