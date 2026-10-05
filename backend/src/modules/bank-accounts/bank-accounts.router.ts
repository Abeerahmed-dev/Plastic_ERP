import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePermission } from '../../middleware/requirePermission';
import {
  listBankAccountsController,
  getBankAccountController,
  createBankAccountController,
  updateBankAccountController,
  deleteBankAccountController,
  getBankAccountTransactionsController,
} from './bank-accounts.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listBankAccountsController);
router.get('/:id/transactions', getBankAccountTransactionsController);
router.get('/:accountId/transactions', getBankAccountTransactionsController);
router.get('/:id', getBankAccountController);
router.post('/', requirePermission('financial_reports:read'), createBankAccountController);
router.put('/:id', requirePermission('financial_reports:read'), updateBankAccountController);
router.delete('/:id', requirePermission('financial_reports:read'), deleteBankAccountController);

export default router;
