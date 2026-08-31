import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import { createUOMSchema, updateUOMSchema } from './uom.schemas';
import * as uomService from './uom.service';
import { ValidationError } from '../../shared/errors';

export async function listUOMController(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await uomService.listUOM();
    res.status(200).json(ok(data));
  } catch (err) { next(err); }
}

export async function createUOMController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createUOMSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }
    const data = await uomService.addUOM(parsed.data);
    res.status(201).json(ok(data));
  } catch (err) { next(err); }
}

export async function updateUOMController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateUOMSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }
    const data = await uomService.editUOM(req.params.id, parsed.data);
    res.status(200).json(ok(data));
  } catch (err) { next(err); }
}

export async function deleteUOMController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await uomService.deactivateUOM(req.params.id);
    res.status(200).json(ok({ message: 'UOM deactivated successfully' }));
  } catch (err) { next(err); }
}
