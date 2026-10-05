import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create inventory_batches (Price Buckets) table
  const hasBatchesTable = await knex.schema.hasTable('inventory_batches');
  if (!hasBatchesTable) {
    await knex.schema.createTable('inventory_batches', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table.uuid('purchase_invoice_id').nullable().references('id').inTable('purchase_invoices').onDelete('SET NULL');
      table.string('batch_number', 50).notNullable();
      table.decimal('batch_buy_price_per_kg', 14, 2).notNullable().defaultTo(0);
      table.decimal('original_qty', 14, 4).notNullable().defaultTo(0);
      table.decimal('remaining_qty', 14, 4).notNullable().defaultTo(0);
      table.string('status', 20).notNullable().defaultTo('ACTIVE'); // 'ACTIVE', 'DEPLETED'
      table.timestamps(true, true);

      table.index('product_id');
      table.index('batch_buy_price_per_kg');
      table.index('remaining_qty');
      table.index('status');
      table.index('created_at');
    });
  }

  // 2. Add batch_id to sales_invoice_items if not present
  const hasSaleBatchId = await knex.schema.hasColumn('sales_invoice_items', 'batch_id');
  if (!hasSaleBatchId) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.uuid('batch_id').nullable().references('id').inTable('inventory_batches').onDelete('SET NULL');
    });
  }

  // 3. Seed initial price-buckets for active products with total_stock_kg > 0
  const productsWithStock = await knex('products')
    .where('total_stock_kg', '>', 0)
    .select('id', 'name', 'code', 'total_stock_kg', 'rolling_avg_cost_per_kg', 'cost_price');

  for (const p of productsWithStock) {
    const stock = Number(p.total_stock_kg || 0);
    const cost = Number(p.rolling_avg_cost_per_kg || p.cost_price || 0);
    const batchNum = `PB-INIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await knex('inventory_batches').insert({
      product_id: p.id,
      batch_number: batchNum,
      batch_buy_price_per_kg: cost,
      original_qty: stock,
      remaining_qty: stock,
      status: stock > 0 ? 'ACTIVE' : 'DEPLETED',
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasSaleBatchId = await knex.schema.hasColumn('sales_invoice_items', 'batch_id');
  if (hasSaleBatchId) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.dropColumn('batch_id');
    });
  }
  await knex.schema.dropTableIfExists('inventory_batches');
}
