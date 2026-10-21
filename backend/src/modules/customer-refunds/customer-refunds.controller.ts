import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import { createCustomerRefundSchema } from './customer-refunds.schemas';
import * as customerRefundsService from './customer-refunds.service';

export async function createCustomerRefundController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createCustomerRefundSchema.parse(req.body);

    // Liquidity Wall: Cannot refund more cash than the account holds
    const refundAmount = Number(input.amount);
    const source = input.source;
    const isCashDrawer = !source || source === 'CASH_DRAWER' || source === 'CASH';

    if (!isCashDrawer) {
      const db = (await import('../../db/knex')).default;
      const account = await db('bank_accounts').where('id', source).first();
      if (!account || Number(account.current_balance) < refundAmount) {
        const { InsufficientLiquidityError } = await import('../../shared/errors');
        throw new InsufficientLiquidityError('INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.');
      }
    } else {
      const { getCashDrawerBalance } = await import('../bank-accounts/bank-accounts.repository');
      const cashBalance = await getCashDrawerBalance();
      if (cashBalance < refundAmount) {
        const { InsufficientLiquidityError } = await import('../../shared/errors');
        throw new InsufficientLiquidityError('INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.');
      }
    }

    const result = await customerRefundsService.processCustomerRefund(input, req.user?.id);
    res.status(201).json(ok(result));
  } catch (err) {
    next(err);
  }
}
