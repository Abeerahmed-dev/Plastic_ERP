import db from '../../db/knex';
import { CreateCategoryInput, UpdateCategoryInput } from './categories.schemas';

export interface CategoryRow {
  id: string;
  name: string;
  bag_weight_kg: number;
  description: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function findAllCategories(): Promise<CategoryRow[]> {
  const rows = await db('categories')
    .select('*')
    .orderBy('name', 'asc');
  
  return rows.map((r) => ({
    ...r,
    bag_weight_kg: Number(r.bag_weight_kg),
  }));
}

export async function findCategoryById(id: string): Promise<CategoryRow | undefined> {
  const row = await db('categories').where({ id }).first();
  if (!row) return undefined;
  return {
    ...row,
    bag_weight_kg: Number(row.bag_weight_kg),
  };
}

export async function findCategoryByName(name: string): Promise<CategoryRow | undefined> {
  const row = await db('categories').whereRaw('LOWER(name) = ?', [name.toLowerCase()]).first();
  if (!row) return undefined;
  return {
    ...row,
    bag_weight_kg: Number(row.bag_weight_kg),
  };
}

export async function createCategory(data: CreateCategoryInput, createdBy?: string): Promise<CategoryRow> {
  const [row] = await db('categories')
    .insert({
      name: data.name,
      bag_weight_kg: data.bag_weight_kg,
      description: data.description ?? null,
      created_by: createdBy ?? null,
    })
    .returning('*');

  return {
    ...row,
    bag_weight_kg: Number(row.bag_weight_kg),
  };
}

export async function updateCategory(id: string, data: UpdateCategoryInput): Promise<CategoryRow | undefined> {
  const [row] = await db('categories')
    .where({ id })
    .update({
      ...data,
      updated_at: new Date(),
    })
    .returning('*');

  if (!row) return undefined;

  return {
    ...row,
    bag_weight_kg: Number(row.bag_weight_kg),
  };
}

export async function deleteCategory(id: string): Promise<boolean> {
  // Check if any product references this category
  const productCount = await db('products').where({ category_id: id }).count<{ count: string }>('* as count').first();
  if (productCount && parseInt(productCount.count, 10) > 0) {
    throw new Error('Cannot delete category: products are assigned to this category.');
  }

  const count = await db('categories').where({ id }).delete();
  return count > 0;
}
