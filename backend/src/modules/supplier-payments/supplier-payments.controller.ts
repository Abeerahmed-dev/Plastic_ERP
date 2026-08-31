import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import { createSupplierPaymentSchema, paymentQuerySchema } from './supplier-payments.schemas';
import * as supplierPaymentsService from './supplier-payments.service';
import { ValidationError } from '../../shared/errors';

export async function createPaymentController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSupplierPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
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
