import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import * as inventoryRepo from './inventory.repository';

export async function getLowStockController(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await inventoryRepo.findLowStockVariants();
    res.json(ok(items));
  } catch (error) {
    next(error);
  }
}
