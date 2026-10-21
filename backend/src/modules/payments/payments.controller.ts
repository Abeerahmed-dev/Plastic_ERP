import { Request, Response, NextFunction } from 'express';
import * as paymentsService from './payments.service';
import { createPaymentSchema } from './payments.schemas';
import { ok } from '../../shared/apiResponse';
import { ValidationError } from '../../shared/errors';

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await paymentsService.getPayments({
      search: req.query.search as string,
      customer_id: req.query.customer_id as string,
      invoice_id: req.query.invoice_id as string,
    });
    res.json(ok(payments));
  } catch (error) {
    next(error);
  }
}

export async function createPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req.user?.roleName || '').toUpperCase();
    if (userRole === 'CASHIER') {
      req.body.payment_method = 'CASH';
    }

    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    const userId = req.user?.id;
    const payment = await paymentsService.createPayment(parsed.data, userId);
    res.status(201).json(ok(payment));
  } catch (error) {
    next(error);
  }
}

export async function clearCheque(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await paymentsService.clearCheque(id);
    res.json(ok({ success: true, message: 'Cheque marked as cleared' }));
  } catch (error) {
    next(error);
  }
}

export async function createRefund(req: Request, res: Response, next: NextFunction) {
  try {
    const { customer_id, amount, source, notes, linked_invoice_id } = req.body;
    if (!customer_id || !amount) {
      throw new ValidationError('Customer and amount are required');
    }
    const payment = await paymentsService.createRefund({
      customer_id,
      amount: Number(amount),
      source: source || 'CASH_DRAWER',
      notes: notes || 'Customer Cash Refund from Advance Wallet',
      linked_invoice_id: linked_invoice_id || null,
    }, req.user?.id);
    res.status(201).json(ok(payment));
  } catch (error) {
    next(error);
  }
}
