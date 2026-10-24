import { Request, Response, NextFunction } from 'express';
import * as paymentsService from './payments.service';
import { createPaymentSchema } from './payments.schemas';
import { ok } from '../../shared/apiResponse';
import { ValidationError } from '../../shared/errors';
import db from '../../db/knex';

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

export async function createPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userRole = (req.user?.roleName || '').toUpperCase();
    if (userRole === 'CASHIER' && req.body.payment_method !== 'SPLIT') {
      req.body.payment_method = 'CASH';
    }

    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    // Phase 1: Strict settlement cap
    if (parsed.data.invoice_id) {
      const invoice = await db('sales_invoices')
        .where('id', parsed.data.invoice_id)
        .first();

      if (!invoice) {
        res.status(404).json({ error: 'Invoice not found.' });
        return;
      }

      const allocRes = await db('payment_allocations')
        .where('invoice_id', parsed.data.invoice_id)
        .sum('allocated_amount as total_allocated')
        .first();

      const retRes = await db('sales_invoices')
        .where('parent_invoice_id', parsed.data.invoice_id)
        .where(function() {
          this.where('invoice_type', 'CREDIT_NOTE')
            .orWhere('invoice_type', 'RETURN')
            .orWhere('invoice_number', 'like', 'CN-%');
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
