import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import {
  createEmployeeController,
  listEmployeesController,
  getEmployeeByIdController,
  updateEmployeeController,
  deleteEmployeeController,
  getEmployeeLedgerController,
  addEmployeeLedgerEntryController,
  deleteEmployeeLedgerEntryController,
} from './employees.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listEmployeesController);
router.get('/:id', getEmployeeByIdController);
router.post('/', createEmployeeController);
router.put('/:id', updateEmployeeController);
router.delete('/:id', deleteEmployeeController);

// Employee Ledger & Advances
router.get('/:id/ledger', getEmployeeLedgerController);
router.post('/:id/ledger', addEmployeeLedgerEntryController);
router.delete('/:id/ledger/:entryId', deleteEmployeeLedgerEntryController);

export { router as employeesRouter };

