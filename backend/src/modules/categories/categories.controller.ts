import { Request, Response, NextFunction } from 'express';
import * as categoryService from './categories.service';
import { ok } from '../../shared/apiResponse';
import { createCategorySchema, updateCategorySchema } from './categories.schemas';

export async function getCategoriesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await categoryService.getAllCategories();
    res.json(ok(categories));
  } catch (err) {
    next(err);
  }
}

export async function getCategoryByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    res.json(ok(category));
  } catch (err) {
    next(err);
  }
}

export async function createCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = createCategorySchema.parse(req.body);
    const userId = (req as any).user?.id;
    const category = await categoryService.createCategory(validated, userId);
    res.status(201).json(ok(category));
  } catch (err) {
    next(err);
  }
}

export async function updateCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = updateCategorySchema.parse(req.body);
    const category = await categoryService.updateCategory(req.params.id, validated);
    res.json(ok(category));
  } catch (err) {
    next(err);
  }
}

export async function deleteCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await categoryService.deleteCategory(req.params.id);
    res.json(ok(null));
  } catch (err) {
    next(err);
  }
}
