import { Request, Response, NextFunction } from 'express';
import * as paymentsService from './payments.service';
import { createPaymentSchema } from './payments.schemas';
import { ok } from '../../shared/apiResponse';
import { ValidationError } from '../../shared/errors';

export async function listPayments(_req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await paymentsService.getPayments();
    res.json(ok(payments));
  } catch (error) {
    next(error);
  }
}

export async function createPayment(req: Request, res: Response, next: NextFunction) {
  try {
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
