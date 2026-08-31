import db from '../../db/knex';
import { CreateProductInput, UpdateProductInput, ProductQuery } from './products.schemas';

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  uom_id: string;
  cost_price: number;
  sale_price: number;
  opening_stock: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProductWithStock extends ProductRow {
  current_stock: number;
  uom_abbreviation: string;
}

/**
 * Generate the next product code: PROD-NNNN.
 */
export async function generateProductCode(): Promise<string> {
  const result = await db('products')
    .max('code as max_code')
    .first<{ max_code: string | null }>();

  if (!result?.max_code) {
    return 'PROD-0001';
  }

  const parts = result.max_code.split('-');
  const num = parseInt(parts[1] ?? '0', 10);
  return `PROD-${String(num + 1).padStart(4, '0')}`;
}

/**
 * Compute current stock for a product.
 * Session 04: only opening_stock.
 * Future sessions (Inventory) will add stock movements.
 */
export async function computeCurrentStock(productId: string): Promise<number> {
  const product = await db('products').where({ id: productId }).select('opening_stock').first<{ opening_stock: number }>();
  if (!product) return 0;
  
  let currentStock = Number(product.opening_stock);

  // Add purchased quantities
  const purchases = await db('purchase_invoice_items')
    .where('product_id', productId)
    .sum('quantity as total_in')
    .first();
  if (purchases && purchases.total_in) {
    currentStock += Number(purchases.total_in);
  }

  // Subtract sold quantities
  const sales = await db('sales_invoice_items')
    .where('product_id', productId)
    .sum('quantity as total_out')
    .first();
  if (sales && sales.total_out) {
    currentStock -= Number(sales.total_out);
  }

  return currentStock;
}

export async function findAllProducts(query: ProductQuery): Promise<{
  rows: ProductWithStock[];
  total: number;
}> {
  const { page, limit, search, category, is_active } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('products')
    .join('units_of_measure as u', 'products.uom_id', 'u.id')
    .modify((qb) => {
      if (search) {
        qb.where((inner) => {
          inner
            .whereILike('products.name', `%${search}%`)
            .orWhereILike('products.code', `%${search}%`);
        });
      }
      if (category) qb.where({ 'products.category': category });
      if (is_active !== undefined) qb.where({ 'products.is_active': is_active });
      else qb.where({ 'products.is_active': true });
    });

  const [{ count }] = await baseQuery.clone().count<[{ count: string }]>('products.id as count');
  const total = parseInt(count, 10);

  const rows = await baseQuery
    .clone()
    .select('products.*', 'u.abbreviation as uom_abbreviation')
    .orderBy('products.name', 'asc')
    .limit(limit)
    .offset(offset);

  const withStock: ProductWithStock[] = await Promise.all(
    rows.map(async (r: ProductRow & { uom_abbreviation: string }) => ({
      ...r,
      current_stock: await computeCurrentStock(r.id),
    }))
  );

  return { rows: withStock, total };
}

export async function findProductById(id: string): Promise<ProductWithStock | undefined> {
  const product = await db('products')
    .join('units_of_measure as u', 'products.uom_id', 'u.id')
    .select('products.*', 'u.abbreviation as uom_abbreviation')
    .where({ 'products.id': id })
    .first();

  if (!product) return undefined;

  return {
    ...product,
    current_stock: await computeCurrentStock(product.id),
  };
}

export async function findPOSAvailableProducts(search?: string): Promise<ProductWithStock[]> {
  const baseQuery = db('products')
    .join('units_of_measure as u', 'products.uom_id', 'u.id')
    .where('products.is_active', true)
    .modify((qb) => {
      if (search) {
        qb.where((inner) => {
          inner
            .whereILike('products.name', `%${search}%`)
            .orWhereILike('products.code', `%${search}%`);
        });
      }
    });

  const rows = await baseQuery
    .select('products.*', 'u.abbreviation as uom_abbreviation')
    .orderBy('products.name', 'asc');

  const withStock: ProductWithStock[] = await Promise.all(
    rows.map(async (r: ProductRow & { uom_abbreviation: string }) => ({
      ...r,
      current_stock: await computeCurrentStock(r.id),
    }))
  );

  return withStock.filter((p) => p.current_stock > 0);
}

export async function createProduct(
  data: CreateProductInput,
  createdBy: string,
): Promise<ProductWithStock> {
  const code = await generateProductCode();

  const [row] = await db('products')
    .insert({
      code,
      name: data.name,
      description: data.description ?? null,
      category: data.category,
      uom_id: data.uom_id,
      cost_price: data.cost_price,
      sale_price: data.sale_price,
      opening_stock: data.opening_stock,
      notes: data.notes ?? null,
      created_by: createdBy,
    })
    .returning('*');

  // fetch the joined row
  return findProductById(row.id) as Promise<ProductWithStock>;
}

export async function updateProduct(
  id: string,
  data: UpdateProductInput,
): Promise<ProductWithStock | undefined> {
  const [row] = await db('products')
    .where({ id })
    .update({ ...data, updated_at: new Date() })
    .returning('*');

  if (!row) return undefined;
  
  return findProductById(row.id) as Promise<ProductWithStock>;
}

export async function softDeleteProduct(id: string): Promise<boolean> {
  const count = await db('products').where({ id }).update({ is_active: false, updated_at: new Date() });
  return count > 0;
}
