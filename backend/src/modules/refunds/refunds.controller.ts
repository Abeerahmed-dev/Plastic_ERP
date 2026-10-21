import { Request, Response, NextFunction } from 'express';
import * as refundsService from './refunds.service';
import {
  createCustomerRefundSchema,
  createSupplierRefundSchema,
  createRefundSchema,
} from './refunds.schemas';
import { ok } from '../../shared/apiResponse';
import { ValidationError, InsufficientLiquidityError } from '../../shared/errors';
import db from '../../db/knex';
import { getCashDrawerBalance } from '../bank-accounts/bank-accounts.repository';

export async function createCustomerRefundController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createCustomerRefundSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    // Liquidity Wall: Cannot refund more cash than the source account holds
    const refundAmount = Number(parsed.data.amount);
    const source = parsed.data.source;
    const isCashDrawer = !source || source === 'CASH_DRAWER' || source === 'CASH';

    if (!isCashDrawer) {
      const account = await db('bank_accounts').where('id', source).first();
      if (!account || Number(account.current_balance) < refundAmount) {
        throw new InsufficientLiquidityError('INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.');
      }
    } else {
      const cashBalance = await getCashDrawerBalance();
      if (cashBalance < refundAmount) {
        throw new InsufficientLiquidityError('INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.');
      }
    }

    const userId = req.user?.id;
    const result = await refundsService.createCustomerRefund(parsed.data, userId);
    res.status(201).json(ok(result));
  } catch (error) {
    next(error);
  }
}

export async function createSupplierRefundController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSupplierRefundSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    // Liquidity Wall: Cannot refund more cash than the source account holds
    const refundAmount = Number(parsed.data.amount);
    const source = parsed.data.source;
    const isCashDrawer = !source || source === 'CASH_DRAWER' || source === 'CASH';

    if (!isCashDrawer) {
      const account = await db('bank_accounts').where('id', source).first();
      if (!account || Number(account.current_balance) < refundAmount) {
        throw new InsufficientLiquidityError('INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.');
      }
    } else {
      const cashBalance = await getCashDrawerBalance();
      if (cashBalance < refundAmount) {
        throw new InsufficientLiquidityError('INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.');
      }
    }

    const userId = req.user?.id;
    const result = await refundsService.createSupplierRefund(parsed.data, userId);
    res.status(201).json(ok(result));
  } catch (error) {
    next(error);
  }
}

export async function createGeneralRefundController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createRefundSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const userId = req.user?.id;
    const { entity_type, customer_id, supplier_id } = parsed.data;

    if (customer_id || entity_type?.toLowerCase() === 'customer') {
      if (!customer_id) throw new ValidationError('customer_id is required for customer refund');
      const result = await refundsService.createCustomerRefund(
        { ...parsed.data, customer_id },
        userId
      );
      res.status(201).json(ok(result));
      return;
    }

    if (supplier_id || entity_type?.toLowerCase() === 'supplier') {
      if (!supplier_id) throw new ValidationError('supplier_id is required for supplier refund');
      const result = await refundsService.createSupplierRefund(
        { ...parsed.data, supplier_id },
        userId
      );
      res.status(201).json(ok(result));
      return;
    }

    throw new ValidationError('Either customer_id or supplier_id must be provided');
  } catch (error) {
    next(error);
  }
}
