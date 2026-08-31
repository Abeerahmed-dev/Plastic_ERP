import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from './products.schemas';
import * as productsService from './products.service';
import { ValidationError } from '../../shared/errors';

export async function listProductsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = productQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }
    const { data, meta } = await productsService.listProducts(parsed.data);
    res.status(200).json(ok(data, meta));
  } catch (err) { next(err); }
}

export async function listPOSAvailableProductsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = req.query.search as string | undefined;
    const data = await productsService.listPOSAvailableProducts(search);
    res.status(200).json(ok(data));
  } catch (err) { next(err); }
}

export async function getProductController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productsService.getProduct(req.params.id);
    res.status(200).json(ok(product));
  } catch (err) { next(err); }
}

export async function createProductController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }
    const product = await productsService.addProduct(parsed.data, req.user!.id);
    res.status(201).json(ok(product));
  } catch (err) { next(err); }
}

export async function updateProductController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }
    const product = await productsService.editProduct(req.params.id, parsed.data);
    res.status(200).json(ok(product));
  } catch (err) { next(err); }
}

export async function deleteProductController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await productsService.deactivateProduct(req.params.id);
    res.status(200).json(ok({ message: 'Product deactivated successfully' }));
  } catch (err) { next(err); }
}
