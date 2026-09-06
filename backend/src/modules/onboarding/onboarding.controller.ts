import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import {
  bulkCustomersOnboardingSchema,
  bulkSuppliersOnboardingSchema,
  bulkInventoryOnboardingSchema,
} from './onboarding.schemas';
import { onboardingService } from './onboarding.service';

export async function bulkCustomersController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = bulkCustomersOnboardingSchema.parse(req.body);
    const createdBy = req.user!.id;
    const result = await onboardingService.bulkInsertCustomers(input.customers, createdBy);

    res.status(201).json(
      ok({
        message: `Successfully initialized ${result.length} customer account(s).`,
        count: result.length,
        customers: result,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function bulkSuppliersController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = bulkSuppliersOnboardingSchema.parse(req.body);
    const createdBy = req.user!.id;
    const result = await onboardingService.bulkInsertSuppliers(input.suppliers, createdBy);

    res.status(201).json(
      ok({
        message: `Successfully initialized ${result.length} supplier debt record(s).`,
        count: result.length,
        suppliers: result,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function bulkInventoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = bulkInventoryOnboardingSchema.parse(req.body);
    const createdBy = req.user!.id;
    const result = await onboardingService.bulkInitializeInventory(input.items, createdBy);

    res.status(201).json(
      ok({
        message: `Successfully initialized opening stock for ${result.length} product(s).`,
        count: result.length,
        records: result,
      }),
    );
  } catch (err) {
    next(err);
  }
}
