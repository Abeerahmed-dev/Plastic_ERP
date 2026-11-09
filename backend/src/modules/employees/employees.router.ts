import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
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

router.get('/', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), listEmployeesController);
router.get('/:id', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), getEmployeeByIdController);
router.post('/', verifyRole(['OWNER', 'ADMIN']), createEmployeeController);
router.put('/:id', verifyRole(['OWNER', 'ADMIN']), updateEmployeeController);
router.delete('/:id', verifyRole(['OWNER', 'ADMIN']), deleteEmployeeController);

// Employee Ledger & Advances
router.get('/:id/ledger', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), getEmployeeLedgerController);
router.post('/:id/ledger', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), addEmployeeLedgerEntryController);
router.delete('/:id/ledger/:entryId', verifyRole(['OWNER', 'ADMIN']), deleteEmployeeLedgerEntryController);

export { router as employeesRouter };
