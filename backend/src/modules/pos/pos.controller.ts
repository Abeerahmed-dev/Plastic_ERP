import { Request, Response, NextFunction } from 'express';
import { checkoutSchema } from './pos.schemas';
import * as posService from './pos.service';
import { ok } from '../../shared/apiResponse';

export async function checkoutController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = checkoutSchema.parse(req.body);
    const invoice = await posService.checkout(req.user!.id, parsed);
    res.status(201).json(ok(invoice));
  } catch (err) {
    next(err);
  }
}
