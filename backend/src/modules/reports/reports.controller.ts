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
