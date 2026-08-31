import { Request, Response, NextFunction } from 'express';
import * as invoicesService from './invoices.service';
import { createInvoiceSchema } from './invoices.schemas';
import { ok } from '../../shared/apiResponse';
import { ValidationError } from '../../shared/errors';

export async function listInvoices(_req: Request, res: Response, next: NextFunction) {
  try {
    const invoices = await invoicesService.getInvoices();
    res.json(ok(invoices));
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
    const parsed = createInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    const userId = req.user?.id;
    const invoice = await invoicesService.createInvoice(parsed.data, userId);
    res.status(201).json(ok(invoice));
  } catch (error) {
    next(error);
  }
}
