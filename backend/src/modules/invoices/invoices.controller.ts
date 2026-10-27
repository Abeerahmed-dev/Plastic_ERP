import { Request, Response, NextFunction } from 'express';
import * as invoicesService from './invoices.service';
import { createInvoiceSchema, createSalesReturnSchema } from './invoices.schemas';
import { ok } from '../../shared/apiResponse';
import { ValidationError, ForbiddenError } from '../../shared/errors';

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const queryFilter: { created_by?: string; is_pos_only?: boolean } = {};
    if (req.query.type === 'pos' || req.query.is_pos_only === 'true') {
      queryFilter.is_pos_only = true;
    }

    const invoices = await invoicesService.getInvoices(queryFilter);
    res.json(ok(invoices));
  } catch (error) {
    next(error);
  }
}

export async function getUnpaidInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const customer_id = req.query.customer_id as string;

    const queryFilter: { created_by?: string; customer_id?: string; is_pos_only?: boolean } = {};
    if (req.query.type === 'pos' || req.query.is_pos_only === 'true') {
      queryFilter.is_pos_only = true;
    }

    const invoices = await invoicesService.getInvoices(queryFilter);
    const unpaidInvoices = invoices.filter((inv: any) => {
      const matchCustomer = customer_id ? inv.customer_id === customer_id : true;
      return matchCustomer && ['UNPAID', 'PARTIAL'].includes(inv.status);
    });

    res.json(ok(unpaidInvoices));
  } catch (error) {
    next(error);
  }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.getInvoice(req.params.id);
    res.json(ok(invoice));
  } catch (error) {
    next(error);
  }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    // Strict SKU Enforcement: Size/Variant is compulsory for all line items
    if (!req.body?.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
      throw new ValidationError('At least one item is required');
    }
    for (const item of req.body.items) {
      if (!item.product_id) {
        throw new ValidationError('Size/Variant is compulsory');
      }
      if (item.size !== undefined && (item.size === null || String(item.size).trim() === '')) {
        throw new ValidationError('Size/Variant is compulsory');
      }
    }

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

export async function getPendingDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const deliveries = await invoicesService.getPendingDeliveries(req.query as any);
    res.json(ok(deliveries));
  } catch (error) {
    next(error);
  }
}



