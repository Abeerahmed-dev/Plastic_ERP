import db from '../../db/knex';
import { Knex } from 'knex';
import { CreateProductInput, UpdateProductInput, ProductQuery } from './products.schemas';
import { ValidationError } from '../../shared/errors';

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  name_urdu?: string | null;
  size: string | null;
  low_stock_threshold?: number;
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
  has_transactions?: boolean;
  transaction_count?: number;
  historical_wac?: number;
}

export function parseDimension(sizeStr: string | null | undefined): [number, number, string] {
  if (!sizeStr || typeof sizeStr !== 'string') return [Infinity, Infinity, ''];
  const cleaned = sizeStr.trim();
  const dimMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/);
  if (dimMatch) {
    const width = parseFloat(dimMatch[1]);
    const length = parseFloat(dimMatch[2]);
    return [isNaN(width) ? Infinity : width, isNaN(length) ? Infinity : length, cleaned.toLowerCase()];
  }
  const singleMatch = cleaned.match(/^(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const num = parseFloat(singleMatch[1]);
    return [isNaN(num) ? Infinity : num, Infinity, cleaned.toLowerCase()];
  }
  return [Infinity, Infinity, cleaned.toLowerCase()];
}

export function compareProducts<T extends { name: string; size?: string | null }>(a: T, b: T): number {
  const nameA = (a.name || '').trim().toLowerCase();
  const nameB = (b.name || '').trim().toLowerCase();
  if (nameA !== nameB) {
    return nameA.localeCompare(nameB);
  }
  const [wA, hA, rawA] = parseDimension(a.size);
  const [wB, hB, rawB] = parseDimension(b.size);
  if (wA !== wB) return wA - wB;
  if (hA !== hB) return hA - hB;
  return rawA.localeCompare(rawB, undefined, { numeric: true, sensitivity: 'base' });
}

export async function getProductTransactionCount(
  productId: string,
  client: Knex | Knex.Transaction = db
): Promise<number> {
  const salesQuery: any = client('sales_invoice_items')
    .where('product_id', productId)
    .count('id as count');
  const salesResult = typeof salesQuery?.first === 'function' ? await salesQuery.first() : await salesQuery;
  const salesCount = Array.isArray(salesResult)
    ? Number(salesResult[0]?.count || 0)
    : Number(salesResult?.count || 0);

  const purchasesQuery: any = client('purchase_invoice_items')
    .where('product_id', productId)
    .count('id as count');
  const purchasesResult = typeof purchasesQuery?.first === 'function' ? await purchasesQuery.first() : await purchasesQuery;
  const purchasesCount = Array.isArray(purchasesResult)
    ? Number(purchasesResult[0]?.count || 0)
    : Number(purchasesResult?.count || 0);

  let ledgerCount = 0;
  const hasTx = await client.schema.hasTable('inventory_transactions');
  if (hasTx) {
    const ledgerQuery: any = client('inventory_transactions')
      .where('product_id', productId)
      .where('transaction_type', '!=', 'OPENING_STOCK')
      .count('id as count');
    const ledgerResult = typeof ledgerQuery?.first === 'function' ? await ledgerQuery.first() : await ledgerQuery;
    const ledgerVal = Array.isArray(ledgerResult)
      ? Number(ledgerResult[0]?.count || 0)
      : Number(ledgerResult?.count || 0);
    ledgerCount = ledgerVal;
  }

  return salesCount + purchasesCount + ledgerCount;
}

/**
 * Generate the next product code: PROD-NNNN.
 */
export async function generateProductCode(): Promise<string> {
  const result = await db('products')
    .whereILike('code', 'PROD-%')
    .select('code');

  if (!result || result.length === 0) {
    return 'PROD-0001';
  }

  let maxNum = 0;
  for (const row of result) {
    const parts = (row.code || '').split('-');
    const num = parseInt(parts[1] ?? '0', 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
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
  const { page, limit = 2000, search, category_id, category, is_active } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .modify((qb) => {
      if (search) {
        const tokens = search.trim().split(/\s+/).filter(Boolean);
        if (tokens.length > 0) {
          qb.andWhere((outer) => {
            for (const token of tokens) {
              outer.andWhere((inner) => {
                inner
                  .whereILike('products.name', `%${token}%`)
                  .orWhereILike('products.size', `%${token}%`);
              });
            }
          });
        }
      }
      if (category_id) qb.where({ 'products.category_id': category_id });
      if (category) qb.whereILike('categories.name', `%${category}%`);
      if (is_active !== undefined) qb.where({ 'products.is_active': is_active });
      else qb.where({ 'products.is_active': true });
    });

  const [{ count }] = await baseQuery.clone().count<[{ count: string }]>('products.id as count');
  const total = parseInt(count, 10);

  const rows = await baseQuery
    .clone()
    .select(
      'products.*',
      'categories.name as category_name',
      'categories.name as category',
      'categories.bag_weight_kg as bag_weight_kg',
      db.raw(`(
        EXISTS (SELECT 1 FROM sales_invoice_items WHERE sales_invoice_items.product_id = products.id)
        OR EXISTS (SELECT 1 FROM purchase_invoice_items WHERE purchase_invoice_items.product_id = products.id)
        OR EXISTS (SELECT 1 FROM inventory_transactions WHERE inventory_transactions.product_id = products.id AND inventory_transactions.transaction_type != 'OPENING_STOCK')
      ) as has_transactions`)
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
    has_transactions: Boolean(r.has_transactions),
    historical_wac: Number(r.cost_price || 0),
    opening_stock: Number(r.opening_stock || 0),
  }));

  withStock.sort(compareProducts);

  return { rows: withStock, total };
}

export async function findProductById(
  id: string,
  client: Knex | Knex.Transaction = db
): Promise<ProductWithStock | undefined> {
  const product = await client('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .select(
      'products.*',
      'categories.name as category_name',
      'categories.name as category',
      'categories.bag_weight_kg as bag_weight_kg'
    )
    .where({ 'products.id': id })
    .first();

  if (!product) return undefined;

  const txCount = await getProductTransactionCount(id, client);

  return {
    ...product,
    total_stock_kg: Number(product.total_stock_kg || 0),
    rolling_avg_cost_per_kg: Number(product.rolling_avg_cost_per_kg || product.cost_price || 0),
    fixed_retail_price_per_kg: Number(product.fixed_retail_price_per_kg || product.sale_price || 0),
    bag_weight_kg: Number(product.bag_weight_kg || 25),
    uom_abbreviation: 'KG',
    current_stock: Number(product.total_stock_kg || 0),
    has_transactions: txCount > 0,
    transaction_count: txCount,
    historical_wac: Number(product.cost_price || 0),
    opening_stock: Number(product.opening_stock || 0),
  };
}

export async function findPOSAvailableProducts(search?: string): Promise<ProductWithStock[]> {
  const baseQuery = db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('products.is_active', true)
    .modify((qb) => {
      if (search) {
        const tokens = search.trim().split(/\s+/).filter(Boolean);
        if (tokens.length > 0) {
          qb.andWhere((outer) => {
            for (const token of tokens) {
              outer.andWhere((inner) => {
                inner
                  .whereILike('products.name', `%${token}%`)
                  .orWhereILike('products.size', `%${token}%`);
              });
            }
          });
        }
      }
    });

  const rows = await baseQuery
    .select(
      'products.*',
      'categories.name as category_name',
      'categories.name as category',
      'categories.bag_weight_kg as bag_weight_kg'
    )
    .orderBy('products.name', 'asc');

  const mapped = rows.map((r: any) => ({
    ...r,
    total_stock_kg: Number(r.total_stock_kg || 0),
    rolling_avg_cost_per_kg: Number(r.rolling_avg_cost_per_kg || r.cost_price || 0),
    fixed_retail_price_per_kg: Number(r.fixed_retail_price_per_kg || r.sale_price || 0),
    bag_weight_kg: Number(r.bag_weight_kg || 25),
    uom_abbreviation: 'KG',
    current_stock: Number(r.total_stock_kg || 0),
  }));

  mapped.sort(compareProducts);
  return mapped;
}

export async function createProduct(
  data: CreateProductInput,
  createdBy?: string | null,
): Promise<ProductWithStock> {
  const rawCode = (data as any).product_code || data.code;
  const code = (rawCode && String(rawCode).trim().length > 0)
    ? String(rawCode).trim()
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
    name_urdu: data.name_urdu ?? null,
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
  return await db.transaction(async (trx: Knex.Transaction) => {
    const currentProduct = await trx('products').where({ id }).forUpdate().first();
    if (!currentProduct) return undefined;

    const rawOpeningStock = data.opening_stock_kg !== undefined ? data.opening_stock_kg : data.opening_stock;
    const rawHistoricalWac = data.historical_wac;
    const isAttemptingDayZeroUpdate = rawOpeningStock !== undefined || rawHistoricalWac !== undefined;

    const targetStock = rawOpeningStock !== undefined ? Number(rawOpeningStock) : Number(currentProduct.opening_stock || 0);
    const targetWac = rawHistoricalWac !== undefined ? Number(rawHistoricalWac) : Number(currentProduct.cost_price || 0);

    const stockChanged = rawOpeningStock !== undefined && targetStock !== Number(currentProduct.opening_stock || 0);
    const wacChanged = rawHistoricalWac !== undefined && targetWac !== Number(currentProduct.cost_price || 0);

    if (isAttemptingDayZeroUpdate && (stockChanged || wacChanged)) {
      const txCount = await getProductTransactionCount(id, trx);
      if (txCount > 0) {
        throw new ValidationError('Cannot modify Day Zero stock after transactions have been recorded');
      }

      // If transaction_count === 0, allow the update: overwrite the initial FIFO bucket and recalculate total_stock_kg
      const hasBatches = await trx.schema.hasTable('inventory_batches');
      if (hasBatches) {
        const initBatch = await trx('inventory_batches')
          .where({ product_id: id })
          .whereNull('purchase_invoice_id')
          .first();

        if (targetStock > 0) {
          if (initBatch) {
            await trx('inventory_batches')
              .where({ id: initBatch.id })
              .update({
                original_qty: targetStock,
                remaining_qty: targetStock,
                batch_buy_price_per_kg: targetWac,
                status: 'ACTIVE',
                updated_at: new Date(),
              });
          } else {
            const batchNum = `PB-INIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await trx('inventory_batches').insert({
              product_id: id,
              purchase_invoice_id: null,
              batch_number: batchNum,
              batch_buy_price_per_kg: targetWac,
              original_qty: targetStock,
              remaining_qty: targetStock,
              status: 'ACTIVE',
              size: (data as any).size || currentProduct.size || 'Standard',
            });
          }
        } else if (initBatch) {
          await trx('inventory_batches').where({ id: initBatch.id }).delete();
        }
      }

      const hasTx = await trx.schema.hasTable('inventory_transactions');
      if (hasTx) {
        const openingTx = await trx('inventory_transactions')
          .where({ product_id: id, transaction_type: 'OPENING_STOCK' })
          .first();

        if (targetStock > 0) {
          if (openingTx) {
            await trx('inventory_transactions')
              .where({ id: openingTx.id })
              .update({
                quantity_kg: targetStock,
                unit_cost: targetWac,
                total_asset_value: targetStock * targetWac,
                capital_equity_value: targetStock * targetWac,
                updated_at: new Date(),
              });
          } else {
            await trx('inventory_transactions').insert({
              product_id: id,
              transaction_type: 'OPENING_STOCK',
              quantity_kg: targetStock,
              unit_cost: targetWac,
              total_asset_value: targetStock * targetWac,
              capital_equity_value: targetStock * targetWac,
              notes: 'Day Zero initial opening stock / Capital Equity (Owner Paid)',
              created_by: currentProduct.created_by || null,
            });
          }
        } else if (openingTx) {
          await trx('inventory_transactions').where({ id: openingTx.id }).delete();
        }
      }
    }

    const updatePayload: Record<string, any> = { ...data };
    delete updatePayload.opening_stock_kg;
    delete updatePayload.historical_wac;

    if (stockChanged || wacChanged) {
      updatePayload.opening_stock = targetStock;
      updatePayload.total_stock_kg = targetStock;
      updatePayload.cost_price = targetWac;
      updatePayload.rolling_avg_cost_per_kg = targetWac;
    } else {
      delete updatePayload.opening_stock;
      delete updatePayload.total_stock_kg;
      delete updatePayload.rolling_avg_cost_per_kg;
    }

    if (updatePayload.category_id && updatePayload.category_id !== currentProduct.category_id) {
      const catRow = await trx('categories').where({ id: updatePayload.category_id }).first();
      if (catRow) {
        updatePayload.category = catRow.name;
      }
    }

    updatePayload.updated_at = new Date();

    await trx('products')
      .where({ id })
      .update(updatePayload);

    return findProductById(id, trx);
  });
}

export async function softDeleteProduct(id: string): Promise<boolean> {
  const count = await db('products').where({ id }).update({ is_active: false, updated_at: new Date() });
  return count > 0;
}

export async function getAvailableBatches(_productId: string) {
  return [];
}
