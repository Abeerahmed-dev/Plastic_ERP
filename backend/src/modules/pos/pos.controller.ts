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
    // Strict Retail Cash-and-Carry: Ignore any client overrides for payment_method and bank_account_id
    parsed.payment_method = 'CASH';
    parsed.bank_account_id = null;
    const invoice = await posService.checkout(req.user!.id, parsed, req.user?.roleName);
    res.status(201).json(ok(invoice));
  } catch (err: any) {
    next(err);
  }
}

export async function getTodayCashTallyController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const totalCash = await posService.getCashTallyForUser(userId);
    res.json(ok({ today_cash_tally: totalCash }));
  } catch (err) {
    next(err);
  }
}

export async function getCashierShiftAuditController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const auditData = await posService.getCashierShiftAuditForUser(userId);
    res.json(ok(auditData));
  } catch (err) {
    next(err);
  }
}


