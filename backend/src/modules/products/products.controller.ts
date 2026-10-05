import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from './products.schemas';
import * as productsService from './products.service';
import { ValidationError } from '../../shared/errors';

function sanitizeForCashier(item: any) {
  return {
    id: item.id,
    name: item.name,
    product_name: item.name,
    code: item.code,
    product_code: item.code,
    category: item.category || item.category_name,
    category_name: item.category_name || item.category,
    size: item.size || null,
    total_stock_kg: Number(item.total_stock_kg || item.current_stock || 0),
    current_stock: Number(item.total_stock_kg || item.current_stock || 0),
    fixed_retail_price_per_kg: Number(item.fixed_retail_price_per_kg || item.sale_price || 0),
    sale_price: Number(item.fixed_retail_price_per_kg || item.sale_price || 0),
    bag_weight_kg: Number(item.bag_weight_kg || 25),
  };
}

export async function listProductsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = productQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }
    const { data, meta } = await productsService.listProducts(parsed.data);

    const isCashier = req.user?.roleName?.toUpperCase() === 'CASHIER';
    const sanitizedData = isCashier ? data.map(sanitizeForCashier) : data;

    res.status(200).json(ok(sanitizedData, meta));
  } catch (err) { next(err); }
}

export async function listPOSAvailableProductsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = req.query.search as string | undefined;
    const data = await productsService.listPOSAvailableProducts(search);

    const isCashier = req.user?.roleName?.toUpperCase() === 'CASHIER';
    const sanitizedData = isCashier ? data.map(sanitizeForCashier) : data;

    res.status(200).json(ok(sanitizedData));
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
    const userId = req.user?.id || null;
    const product = await productsService.addProduct(parsed.data, userId as string);
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

export async function getProductBatchesController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const batches = await productsService.getProductBatches(req.params.id);
    res.status(200).json(ok(batches));
  } catch (err) { next(err); }
}
