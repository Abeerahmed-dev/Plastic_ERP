import { Request, Response, NextFunction } from 'express';
import { checkoutSchema } from './pos.schemas';
import * as posService from './pos.service';
import { ok } from '../../shared/apiResponse';

export async function checkoutController(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const parsed = checkoutSchema.parse(req.body);
    const invoice = await posService.checkout(req.user!.id, parsed, req.user?.roleName);
    res.status(201).json(ok(invoice));
  } catch (err: any) {
    console.error("SALES API CRASH:", err);
    res.status(500).json({ error: err.message || "Internal Server Error", detail: err.detail });
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


