import * as categoryRepo from './categories.repository';
import { CreateCategoryInput, UpdateCategoryInput } from './categories.schemas';
import { ConflictError, NotFoundError } from '../../shared/errors';

export async function getAllCategories() {
  return await categoryRepo.findAllCategories();
}

export async function getCategoryById(id: string) {
  const cat = await categoryRepo.findCategoryById(id);
  if (!cat) throw new NotFoundError('Category not found');
  return cat;
}

export async function createCategory(data: CreateCategoryInput, createdBy?: string) {
  const existing = await categoryRepo.findCategoryByName(data.name);
  if (existing) {
    throw new ConflictError(`Category with name '${data.name}' already exists.`);
  }

  return await categoryRepo.createCategory(data, createdBy);
}

export async function updateCategory(id: string, data: UpdateCategoryInput) {
  await getCategoryById(id);

  if (data.name) {
    const existing = await categoryRepo.findCategoryByName(data.name);
    if (existing && existing.id !== id) {
      throw new ConflictError(`Category with name '${data.name}' already exists.`);
    }
  }

  return await categoryRepo.updateCategory(id, data);
}

export async function deleteCategory(id: string) {
  await getCategoryById(id);
  return await categoryRepo.deleteCategory(id);
}
