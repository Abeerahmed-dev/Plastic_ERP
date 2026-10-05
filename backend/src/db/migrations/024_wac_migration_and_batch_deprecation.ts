import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Add total_stock_kg and rolling_avg_cost_per_kg to products
  const hasTotalStock = await knex.schema.hasColumn('products', 'total_stock_kg');
  if (!hasTotalStock) {
    await knex.schema.alterTable('products', (table) => {
      table.decimal('total_stock_kg', 14, 4).notNullable().defaultTo(0);
    });
  }

  const hasRollingAvg = await knex.schema.hasColumn('products', 'rolling_avg_cost_per_kg');
  if (!hasRollingAvg) {
    await knex.schema.alterTable('products', (table) => {
      table.decimal('rolling_avg_cost_per_kg', 14, 4).notNullable().defaultTo(0);
    });
  }

  // 2. Add applied_cogs_per_kg to sales_invoice_items
  const hasAppliedCogs = await knex.schema.hasColumn('sales_invoice_items', 'applied_cogs_per_kg');
  if (!hasAppliedCogs) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.decimal('applied_cogs_per_kg', 14, 4).notNullable().defaultTo(0);
    });
  }

  // 3. Backfill total_stock_kg and rolling_avg_cost_per_kg on products
  const products = await knex('products').select('id', 'opening_stock', 'cost_price');

  for (const p of products) {
    let currentStock = Number(p.opening_stock || 0);

    // Sum purchased KGs
    const purchases = await knex('purchase_invoice_items')
      .where('product_id', p.id)
      .select(knex.raw('SUM(COALESCE(net_kg_processed, COALESCE(net_kg_added, quantity))) as total_in'))
      .first();
    if (purchases && (purchases as any).total_in) {
      currentStock += Number((purchases as any).total_in);
    }

    // Subtract sold KGs
    const sales = await knex('sales_invoice_items')
      .where('product_id', p.id)
      .select(knex.raw('SUM(COALESCE(net_kg_processed, quantity)) as total_out'))
      .first();
    if (sales && (sales as any).total_out) {
      currentStock -= Number((sales as any).total_out);
    }

    const avgCost = Number(p.cost_price || 0);

    await knex('products')
      .where({ id: p.id })
      .update({
        total_stock_kg: Math.max(0, currentStock),
        rolling_avg_cost_per_kg: avgCost,
      });
  }

  // Backfill applied_cogs_per_kg on sales_invoice_items from products
  await knex.raw(`
    UPDATE sales_invoice_items
    SET applied_cogs_per_kg = COALESCE(
      (SELECT rolling_avg_cost_per_kg FROM products WHERE products.id = sales_invoice_items.product_id),
      0
    )
    WHERE applied_cogs_per_kg = 0
  `);

  // 4. Drop batch_id FK and column from sales_invoice_items
  const hasBatchId = await knex.schema.hasColumn('sales_invoice_items', 'batch_id');
  if (hasBatchId) {
    await knex.raw('ALTER TABLE sales_invoice_items DROP COLUMN IF EXISTS batch_id CASCADE');
  }

  // 5. Drop batch_id / batch_unit_conversions from purchase_invoice_items if present
  const hasItemConversions = await knex.schema.hasColumn('purchase_invoice_items', 'batch_unit_conversions');
  if (hasItemConversions) {
    await knex.raw('ALTER TABLE purchase_invoice_items DROP COLUMN IF EXISTS batch_unit_conversions CASCADE');
  }

  // 6. Drop inventory_batches table
  await knex.raw('DROP TABLE IF EXISTS inventory_batches CASCADE');
}

export async function down(knex: Knex): Promise<void> {
  const hasAppliedCogs = await knex.schema.hasColumn('sales_invoice_items', 'applied_cogs_per_kg');
  if (hasAppliedCogs) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.dropColumn('applied_cogs_per_kg');
    });
  }

  const hasRollingAvg = await knex.schema.hasColumn('products', 'rolling_avg_cost_per_kg');
  if (hasRollingAvg) {
    await knex.schema.alterTable('products', (table) => {
      table.dropColumn('rolling_avg_cost_per_kg');
    });
  }

  const hasTotalStock = await knex.schema.hasColumn('products', 'total_stock_kg');
  if (hasTotalStock) {
    await knex.schema.alterTable('products', (table) => {
      table.dropColumn('total_stock_kg');
    });
  }
}
