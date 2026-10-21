import db from '../../db/knex';
import { CreateProductInput, UpdateProductInput, ProductQuery } from './products.schemas';

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  size: string;
  low_stock_threshold: number;
  description: string | null;
  category_id: string;
  cost_price: number;
  sale_price: number;
  fixed_retail_price_per_kg: number;
  opening_stock: number;
  total_stock_kg: number;
  rolling_avg_cost_per_kg: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}


export interface ProductWithStock extends ProductRow {
  current_stock: number;
  category_name: string;
  category: string;
  bag_weight_kg: number;
  uom_abbreviation?: string;
}

/**
 * Generate the next product code: PROD-NNNN.
 */
export async function generateProductCode(): Promise<string> {
  const result = await db('products')
    .whereILike('code', 'PROD-%')
    .max('code as max_code')
    .first<{ max_code: string | null }>();

  if (!result?.max_code) {
    return 'PROD-0001';
  }

  const parts = result.max_code.split('-');
  const num = parseInt(parts[1] ?? '0', 10);
  const nextNum = isNaN(num) ? 1 : num + 1;
  return `PROD-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Compute current stock for a product in KG.
 */
export async function computeCurrentStock(productId: string): Promise<number> {
  const product = await db('products').where({ id: productId }).select('total_stock_kg').first<{ total_stock_kg: number }>();
  return product ? Number(product.total_stock_kg || 0) : 0;
}

export async function findAllProducts(query: ProductQuery): Promise<{
  rows: ProductWithStock[];
  total: number;
}> {
  const { page, limit, search, category_id, category, is_active } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('products')
    .join('categories as c', 'products.category_id', 'c.id')
    .modify((qb) => {
      if (search) {
        qb.where((inner) => {
          inner
            .whereILike('products.name', `%${search}%`)
            .orWhereILike('products.code', `%${search}%`)
            .orWhereILike('products.size', `%${search}%`);
        });
      }
      if (category_id) qb.where({ 'products.category_id': category_id });
      if (category) qb.whereILike('c.name', `%${category}%`);
      if (is_active !== undefined) qb.where({ 'products.is_active': is_active });
      else qb.where({ 'products.is_active': true });
    });

  const [{ count }] = await baseQuery.clone().count<[{ count: string }]>('products.id as count');
  const total = parseInt(count, 10);

  const rows = await baseQuery
    .clone()
    .select(
      'products.*',
      'c.name as category_name',
      'c.name as category',
      'c.bag_weight_kg as bag_weight_kg'
    )
    .orderBy('products.name', 'asc')
    .limit(limit)
    .offset(offset);

  const withStock: ProductWithStock[] = rows.map((r: any) => ({
    ...r,
    total_stock_kg: Number(r.total_stock_kg || 0),
    rolling_avg_cost_per_kg: Number(r.rolling_avg_cost_per_kg || r.cost_price || 0),
    fixed_retail_price_per_kg: Number(r.fixed_retail_price_per_kg || r.sale_price || 0),
    bag_weight_kg: Number(r.bag_weight_kg || 25),
    uom_abbreviation: 'KG',
    current_stock: Number(r.total_stock_kg || 0),
  }));

  return { rows: withStock, total };
}

export async function findProductById(id: string): Promise<ProductWithStock | undefined> {
  const product = await db('products')
    .join('categories as c', 'products.category_id', 'c.id')
    .select(
      'products.*',
      'c.name as category_name',
      'c.name as category',
      'c.bag_weight_kg as bag_weight_kg'
    )
    .where({ 'products.id': id })
    .first();

  if (!product) return undefined;

  return {
    ...product,
    total_stock_kg: Number(product.total_stock_kg || 0),
    rolling_avg_cost_per_kg: Number(product.rolling_avg_cost_per_kg || product.cost_price || 0),
    fixed_retail_price_per_kg: Number(product.fixed_retail_price_per_kg || product.sale_price || 0),
    bag_weight_kg: Number(product.bag_weight_kg || 25),
    uom_abbreviation: 'KG',
    current_stock: Number(product.total_stock_kg || 0),
  };
}

export async function findPOSAvailableProducts(search?: string): Promise<ProductWithStock[]> {
  const baseQuery = db('products')
    .join('categories as c', 'products.category_id', 'c.id')
    .where('products.is_active', true)
    .where('products.total_stock_kg', '>', 0)
    .modify((qb) => {
      if (search) {
        qb.where((inner) => {
          inner
            .whereILike('products.name', `%${search}%`)
            .orWhereILike('products.code', `%${search}%`)
            .orWhereILike('products.size', `%${search}%`);
        });
      }
    });

  const rows = await baseQuery
    .select(
      'products.*',
      'c.name as category_name',
      'c.name as category',
      'c.bag_weight_kg as bag_weight_kg'
    )
    .orderBy('products.name', 'asc');

  return rows.map((r: any) => ({
    ...r,
    total_stock_kg: Number(r.total_stock_kg || 0),
    rolling_avg_cost_per_kg: Number(r.rolling_avg_cost_per_kg || r.cost_price || 0),
    fixed_retail_price_per_kg: Number(r.fixed_retail_price_per_kg || r.sale_price || 0),
    bag_weight_kg: Number(r.bag_weight_kg || 25),
    uom_abbreviation: 'KG',
    current_stock: Number(r.total_stock_kg || 0),
  }));
}

export async function createProduct(
  data: CreateProductInput,
  createdBy?: string | null,
): Promise<ProductWithStock> {
  const code = (data.code && data.code.trim().length > 0)
    ? data.code.trim()
    : await generateProductCode();
  const initialStock = data.opening_stock_kg !== undefined
    ? Number(data.opening_stock_kg)
    : Number(data.opening_stock || 0);
  const initialCost = data.historical_wac !== undefined
    ? Number(data.historical_wac)
    : Number(data.cost_price || 0);
  const fixedPrice = data.fixed_retail_price_per_kg || data.sale_price || 0;

  // Retrieve category name to satisfy products.category NOT NULL string constraint
  const categoryRow = await db('categories').where({ id: data.category_id }).first();
  const categoryName = categoryRow ? categoryRow.name : 'General';

  const insertPayload: Record<string, any> = {
    code,
    name: data.name,
    size: (data.size && data.size.trim().length > 0) ? data.size.trim() : 'Standard',
    low_stock_threshold: data.low_stock_threshold !== undefined ? Number(data.low_stock_threshold) : 0,
    description: data.description ?? null,
    category_id: data.category_id,
    category: categoryName,
    cost_price: initialCost,
    sale_price: data.sale_price || 0,
    fixed_retail_price_per_kg: fixedPrice,
    opening_stock: initialStock,
    total_stock_kg: initialStock,
    rolling_avg_cost_per_kg: initialCost,
    notes: data.notes ?? null,
    created_by: createdBy || null,
  };

  const [row] = await db('products')
    .insert(insertPayload)
    .returning('*');

  // Day Zero FIFO Bucket & Valuation (Bypasses purchase_invoices and accounts_payable)
  if (initialStock > 0) {
    const hasBatches = await db.schema.hasTable('inventory_batches');
    if (hasBatches) {
      const batchNum = `PB-INIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await db('inventory_batches').insert({
        product_id: row.id,
        purchase_invoice_id: null,
        batch_number: batchNum,
        batch_buy_price_per_kg: initialCost,
        original_qty: initialStock,
        remaining_qty: initialStock,
        status: 'ACTIVE',
        size: row.size || 'Standard',
      });
    }

    const hasTx = await db.schema.hasTable('inventory_transactions');
    if (hasTx) {
      await db('inventory_transactions').insert({
        product_id: row.id,
        transaction_type: 'OPENING_STOCK',
        quantity_kg: initialStock,
        unit_cost: initialCost,
        total_asset_value: initialStock * initialCost,
        capital_equity_value: initialStock * initialCost,
        notes: 'Day Zero initial opening stock / Capital Equity (Owner Paid)',
        created_by: createdBy || null,
      });
    }
  }

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

export async function getAvailableBatches(_productId: string) {
  return [];
}
