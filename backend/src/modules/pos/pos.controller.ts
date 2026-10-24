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

export async function getPosInvoicesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Both Cashiers and Admins can view all retail store POS invoices
    const invoices = await posService.getPosInvoices({});
    res.json(ok(invoices));
  } catch (err) {
    next(err);
  }
}

export async function getHeldOrdersController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const orders = await posService.getHeldOrders();
    res.json(ok(orders));
  } catch (err) {
    next(err);
  }
}

export async function createHeldOrderController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { createHeldOrderSchema } = await import('./pos.schemas');
    const parsed = createHeldOrderSchema.parse(req.body);
    const order = await posService.saveHeldOrder(req.user!.id, parsed);
    res.status(201).json(ok(order));
  } catch (err) {
    next(err);
  }
}

export async function deleteHeldOrderController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    await posService.removeHeldOrder(id);
    res.json(ok({ deleted: true }));
  } catch (err) {
    next(err);
  }
}


