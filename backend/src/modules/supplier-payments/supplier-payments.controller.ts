import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import { createSupplierPaymentSchema, paymentQuerySchema } from './supplier-payments.schemas';
import * as supplierPaymentsService from './supplier-payments.service';
import { ValidationError } from '../../shared/errors';
import db from '../../db/knex';

export async function createPaymentController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSupplierPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    const payload = parsed.data;
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

    // Phase 1: Strict settlement cap
    if (parsed.data.purchase_invoice_id) {
      const invoice = await db('purchase_invoices')
        .where('id', parsed.data.purchase_invoice_id)
        .first();

      if (!invoice) {
        res.status(404).json({ error: 'Purchase invoice not found.' });
        return;
      }

      const allocRes = await db('supplier_payment_allocations')
        .where('purchase_invoice_id', parsed.data.purchase_invoice_id)
        .sum('allocated_amount as total_allocated')
        .first();

      const retRes = await db('purchase_invoices')
        .where('parent_invoice_id', parsed.data.purchase_invoice_id)
        .where(function() {
          this.where('invoice_type', 'DEBIT_NOTE')
            .orWhere('invoice_type', 'RETURN')
            .orWhere('invoice_number', 'like', 'DN-%');
        })
        .whereNot('status', 'CANCELLED')
        .sum('total_amount as total_returned')
        .first();

      const returnedTotal = Math.abs(Number(retRes?.total_returned || 0));
      const allocatedPayments = Number(allocRes?.total_allocated || 0);
      const totalAmount = Number(invoice.total_amount || 0);
      const netInvoiceTotal = totalAmount - returnedTotal;
      const balanceDue = Math.round((netInvoiceTotal - allocatedPayments) * 100) / 100;

      const incomingAmount = Number(parsed.data.amount);
      if (balanceDue <= 0 || incomingAmount > balanceDue) {
        res.status(400).json({
          error: balanceDue <= 0
            ? 'Cannot make payment on a settled or overpaid invoice.'
            : `Cannot overpay invoice. Maximum balance due is Rs. ${balanceDue}.`,
        });
        return;
      }
    }

    const payment = await supplierPaymentsService.createSupplierPayment(parsed.data, req.user!.id);
    res.status(201).json(ok(payment));
  } catch (err) { next(err); }
}

export async function listPaymentsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = paymentQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }
    const { data, meta } = await supplierPaymentsService.getPayments(parsed.data);
    res.status(200).json(ok(data, meta));
  } catch (err) { next(err); }
}

export async function getPaymentController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payment = await supplierPaymentsService.getPayment(req.params.id);
    res.status(200).json(ok(payment));
  } catch (err) { next(err); }
}

export async function clearChequeController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await supplierPaymentsService.clearCheque(id);
    res.status(200).json(ok({ success: true, message: 'Supplier cheque marked as cleared' }));
  } catch (err) { next(err); }
}
