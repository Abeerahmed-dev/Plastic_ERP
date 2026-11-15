import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  listBankAccountsController,
  getBankAccountController,
  createBankAccountController,
  updateBankAccountController,
  deleteBankAccountController,
  getBankAccountTransactionsController,
  getCashDrawerBalanceController,
  transferFundsController,
} from './bank-accounts.controller';

const router = Router();

router.use(requireAuth);

router.post('/transfer', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT', 'CASHIER']), transferFundsController);
router.get('/', listBankAccountsController);
router.get('/cash-drawer-balance', getCashDrawerBalanceController);
router.get('/:id/transactions', getBankAccountTransactionsController);
router.get('/:accountId/transactions', getBankAccountTransactionsController);
router.get('/:id', getBankAccountController);
router.post('/', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), createBankAccountController);
router.put('/:id', verifyRole(['OWNER', 'ADMIN', 'ACCOUNTANT']), updateBankAccountController);
router.delete('/:id', verifyRole(['OWNER', 'ADMIN']), deleteBankAccountController);

export default router;

