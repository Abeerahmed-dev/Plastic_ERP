import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
} from './suppliers.schemas';
import * as suppliersService from './suppliers.service';

export async function listSuppliersController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = supplierQuerySchema.parse(req.query);
    const { data, meta } = await suppliersService.listSuppliers(query);
    res.status(200).json(ok(data, meta));
  } catch (err) { next(err); }
}

export async function getSupplierController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplier = await suppliersService.getSupplier(req.params.id);
    res.status(200).json(ok(supplier));
  } catch (err) { next(err); }
}

export async function createSupplierController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createSupplierSchema.parse(req.body);
    const supplier = await suppliersService.addSupplier(data, req.user!.id);
    res.status(201).json(ok(supplier));
  } catch (err) { next(err); }
}

export async function updateSupplierController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateSupplierSchema.parse(req.body);
    const supplier = await suppliersService.editSupplier(req.params.id, data);
    res.status(200).json(ok(supplier));
  } catch (err) { next(err); }
}

export async function deleteSupplierController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await suppliersService.deactivateSupplier(req.params.id);
    res.json(ok({ deleted: true, message: 'Supplier deactivated successfully' }));
  } catch (error: any) {
    next(error);
  }
}

export async function getSupplierStatementController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const statement = await suppliersService.getSupplierStatement(req.params.id);
    res.json(ok(statement));
  } catch (error: any) {
    next(error);
  }
}

export async function getSupplierLedgerController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ledger = await suppliersService.getSupplierStatement(req.params.id);
    res.json(ok(ledger));
  } catch (error: any) {
    next(error);
  }
}

export async function getSupplierRefundableCreditsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const credits = await suppliersService.getSupplierRefundableCredits(req.params.id);
    res.json(ok(credits));
  } catch (error: any) {
    next(error);
  }
}

export async function recordSupplierPaymentController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = req.body;
    if (req.params.id && !payload.supplier_id) {
      payload.supplier_id = req.params.id;
    }

    const db = (await import('../../db/knex')).default;
    const trx = db;

    if (!payload.bank_account_id) {
      throw new Error('VALIDATION_ERROR: No bank_account_id provided in the request payload.');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.bank_account_id);
    const account = isUuid ? await trx('bank_accounts').where('id', payload.bank_account_id).first() : null;

    if (!account) {
      throw new Error(`NOT_FOUND: Bank account with ID ${payload.bank_account_id} does not exist.`);
    }

    const availableBalance = parseFloat(account.current_balance || 0);
    const requestedAmount = parseFloat((payload.amount as any) || 0);

    if (availableBalance < requestedAmount) {
      throw new Error(`INSUFFICIENT_LIQUIDITY: Cannot withdraw ${requestedAmount}. Account only holds ${availableBalance}.`);
    }

    const { createSupplierPayment } = await import('../supplier-payments/supplier-payments.service');
    const payment = await createSupplierPayment(payload, req.user!.id);
    res.status(201).json(ok(payment));
  } catch (error: any) {
    next(error);
  }
}


