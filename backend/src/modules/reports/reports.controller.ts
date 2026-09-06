import { Request, Response, NextFunction } from 'express';
import { reportsService } from './reports.service';
import { ok } from '../../shared/apiResponse';

export async function getDashboardController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const metrics = await reportsService.getDashboardMetrics();
    res.status(200).json(ok(metrics));
  } catch (err) {
    next(err);
  }
}

export async function getInventoryLedgerController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await reportsService.getInventoryLedgerReport();
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function getLiquidityLedgerController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await reportsService.getLiquidityLedgerReport();
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function getLiquidityReceivablesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await reportsService.getLiquidityReceivablesDetail();
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function getLiquidityPayablesController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await reportsService.getLiquidityPayablesDetail();
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function getLiquidityUnsoldStockController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await reportsService.getLiquidityUnsoldStockDetail();
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function getProfitMatrixController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const productId = req.query.productId ? String(req.query.productId) : undefined;
    const timeFilter = req.query.timeFilter ? String(req.query.timeFilter) : undefined;
    const data = await reportsService.getProfitMatrixReport(productId, timeFilter);
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function getSalesMarginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const productId = req.query.productId ? String(req.query.productId) : undefined;
    const timeFilter = req.query.timeFilter ? String(req.query.timeFilter) : undefined;
    const data = await reportsService.getSalesMarginReport(productId, timeFilter);
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function getCashierTallyController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const data = await reportsService.getCashierTallyReport(userId);
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}
