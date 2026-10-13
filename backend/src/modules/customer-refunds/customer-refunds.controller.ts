import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import { createCustomerRefundSchema } from './customer-refunds.schemas';
import * as customerRefundsService from './customer-refunds.service';

export async function createCustomerRefundController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createCustomerRefundSchema.parse(req.body);
    const result = await customerRefundsService.processCustomerRefund(input, req.user?.id);
    res.status(201).json(ok(result));
  } catch (err) {
    next(err);
  }
}
