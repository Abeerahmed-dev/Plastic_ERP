import { Request, Response, NextFunction } from 'express';
import * as advancesService from './advances.service';
import {
  createCustomerAdvanceSchema,
  createSupplierAdvanceSchema,
  createAdvanceSchema,
} from './advances.schemas';
import { ok } from '../../shared/apiResponse';
import { ValidationError } from '../../shared/errors';

export async function createCustomerAdvanceController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createCustomerAdvanceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const userId = req.user?.id;
    const result = await advancesService.createCustomerAdvance(parsed.data, userId);
    res.status(201).json(ok(result));
  } catch (error) {
    next(error);
  }
}

export async function createSupplierAdvanceController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSupplierAdvanceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const userId = req.user?.id;
    const result = await advancesService.createSupplierAdvance(parsed.data, userId);
    res.status(201).json(ok(result));
  } catch (error) {
    next(error);
  }
}

export async function createGeneralAdvanceController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createAdvanceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    const userId = req.user?.id;
    const { entity_type, customer_id, supplier_id } = parsed.data;

    if (customer_id || entity_type?.toLowerCase() === 'customer') {
      if (!customer_id) throw new ValidationError('customer_id is required for customer advance');
      const result = await advancesService.createCustomerAdvance(
        { ...parsed.data, customer_id },
        userId
      );
      res.status(201).json(ok(result));
      return;
    }

    if (supplier_id || entity_type?.toLowerCase() === 'supplier') {
      if (!supplier_id) throw new ValidationError('supplier_id is required for supplier advance');
      const result = await advancesService.createSupplierAdvance(
        { ...parsed.data, supplier_id },
        userId
      );
      res.status(201).json(ok(result));
      return;
    }

    throw new ValidationError('Either customer_id or supplier_id must be provided');
  } catch (error) {
    next(error);
  }
}
