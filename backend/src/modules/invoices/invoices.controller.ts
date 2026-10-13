import { Request, Response, NextFunction } from 'express';
import * as invoicesService from './invoices.service';
import { createInvoiceSchema, createSalesReturnSchema } from './invoices.schemas';
import { ok } from '../../shared/apiResponse';
import { ValidationError, ForbiddenError } from '../../shared/errors';

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req.user?.roleName || (req.user as any)?.role || '').trim().toUpperCase();
    const userId = req.user?.id;

    // RBAC: Cashiers can only view invoices they personally created
    const queryFilter: { created_by?: string } = {};
    if (userRole === 'CASHIER' && userId) {
      queryFilter.created_by = userId;
    }
    // If role is 'Owner' / 'Admin', the filter remains empty, fetching all company invoices.

    const invoices = await invoicesService.getInvoices(queryFilter);
    res.json(ok(invoices));
  } catch (error) {
    next(error);
  }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.getInvoice(req.params.id);
    const userRole = (req.user?.roleName || (req.user as any)?.role || '').trim().toUpperCase();
    const userId = req.user?.id;

    // RBAC: Cashiers can only fetch invoices they created
    if (userRole === 'CASHIER' && userId && invoice.created_by && invoice.created_by !== userId) {
      throw new ForbiddenError('You are only authorized to view invoices you personally created.');
    }

    res.json(ok(invoice));
  } catch (error) {
    next(error);
  }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    const userRole = (req.user?.roleName || (req.user as any)?.role || '').toUpperCase();
    const isCashier = userRole === 'CASHIER';

    const amountPaid = Number((req.body as any).amount_paid || (req.body as any).paid_amount || 0);
    const subtotal = parsed.data.items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unit_price)), 0);
    const grandTotal = subtotal - (parsed.data.discount || 0);

    if (isCashier && amountPaid > grandTotal + 0.01) {
      throw new ForbiddenError('Cashiers cannot receive excess ledger payments.');
    }

    const userId = req.user?.id;
    const invoice = await invoicesService.createInvoice(parsed.data, userId);
    res.status(201).json(ok(invoice));
  } catch (error: any) {
    next(error);
  }
}

export async function getInvoiceReturnSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await invoicesService.getInvoiceReturnSummary(req.params.id);
    res.json(ok(summary));
  } catch (error) {
    next(error);
  }
}

export async function createSalesReturn(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createSalesReturnSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    const userId = req.user?.id;
    const creditNote = await invoicesService.processSalesReturn(req.params.id, parsed.data, userId);
    res.status(201).json(ok(creditNote));
  } catch (error) {
    next(error);
  }
}

