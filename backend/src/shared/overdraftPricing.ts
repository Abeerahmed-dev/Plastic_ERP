import type { Knex } from 'knex';

export interface ProductFallbackPricing {
  base_price?: number | string | null;
  cost_price?: number | string | null;
  rolling_avg_cost_per_kg?: number | string | null;
}

export interface LatestBatchPriceResult {
  unitPrice: number;
  source: 'LATEST_BATCH' | 'PRODUCT_FALLBACK' | 'ZERO';
}

export interface OverdraftEstimateResult extends LatestBatchPriceResult {
  deferredQty: number;
  estimatedCogs: number;
}

/**
 * Resolve the latest market batch purchase price for a product when estimating overdraft COGS.
 *
 * Strictly queries the most recent batch by `created_at DESC`:
 *   SELECT buy_price_per_kg FROM inventory_batches WHERE product_id = ? ORDER BY created_at DESC LIMIT 1
 *
 * Fallback guard: if no historical batches exist at all for the product,
 * falls back to the product's base/cost price or 0.
 */
export async function getLatestMarketBatchPrice(
  trx: Knex | Knex.Transaction,
  productId: string,
  productRow?: ProductFallbackPricing | null
): Promise<LatestBatchPriceResult> {
  const hasBuyPriceCol =
    typeof trx?.schema?.hasColumn === 'function'
      ? await trx.schema.hasColumn('inventory_batches', 'buy_price_per_kg')
      : true;

  const latestBatch = await trx('inventory_batches')
    .where('product_id', productId)
    .orderBy('created_at', 'desc')
    .select(hasBuyPriceCol ? 'buy_price_per_kg' : 'batch_buy_price_per_kg')
    .first();

  if (latestBatch) {
    const rawBatchPrice = latestBatch.buy_price_per_kg ?? latestBatch.batch_buy_price_per_kg ?? 0;
    const latestBatchPrice = Math.round(Number(rawBatchPrice) * 100) / 100;
    return {
      unitPrice: latestBatchPrice,
      source: 'LATEST_BATCH',
    };
  }

  // Fallback Guard: no historical batches exist for this product
  const resolvedProduct: ProductFallbackPricing | null | undefined =
    productRow &&
    (productRow.base_price !== undefined ||
      productRow.cost_price !== undefined ||
      productRow.rolling_avg_cost_per_kg !== undefined)
      ? productRow
      : await trx('products').where({ id: productId }).first();

  const rawBasePrice = resolvedProduct?.base_price;
  const rawCostPrice = resolvedProduct?.cost_price;
  const rawRollingWac = resolvedProduct?.rolling_avg_cost_per_kg;

  const fallbackPrice =
    rawBasePrice !== undefined && rawBasePrice !== null && Number(rawBasePrice) > 0
      ? Number(rawBasePrice)
      : rawCostPrice !== undefined && rawCostPrice !== null && Number(rawCostPrice) > 0
        ? Number(rawCostPrice)
        : rawRollingWac !== undefined && rawRollingWac !== null && Number(rawRollingWac) > 0
          ? Number(rawRollingWac)
          : 0;

  const roundedFallback = Math.round(fallbackPrice * 100) / 100;
  return {
    unitPrice: roundedFallback,
    source: roundedFallback > 0 ? 'PRODUCT_FALLBACK' : 'ZERO',
  };
}

/**
 * Shared Overdraft Split Engine estimator:
 *   estimated_cogs = deferred_qty * latest_batch_price
 */
export async function estimateOverdraftCogs(
  trx: Knex | Knex.Transaction,
  productId: string,
  deferredQty: number,
  productRow?: ProductFallbackPricing | null
): Promise<OverdraftEstimateResult> {
  const safeDeferredQty = Math.max(0, Number(deferredQty || 0));
  if (safeDeferredQty <= 0) {
    return {
      unitPrice: 0,
      deferredQty: 0,
      estimatedCogs: 0,
      source: 'ZERO',
    };
  }

  const { unitPrice, source } = await getLatestMarketBatchPrice(trx, productId, productRow);
  const estimatedCogs = Math.round(safeDeferredQty * unitPrice * 100) / 100;

  return {
    unitPrice,
    deferredQty: safeDeferredQty,
    estimatedCogs,
    source,
  };
}

