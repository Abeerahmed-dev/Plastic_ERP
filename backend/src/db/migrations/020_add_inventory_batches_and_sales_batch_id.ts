import type { Knex } from 'knex';

const DEFAULT_CONVERSIONS = JSON.stringify({
  Bora: 25.0,
  Peti: 15.0,
  Dasti: 0.5,
  Pura: 5.0,
  KG: 1.0,
});

export async function up(knex: Knex): Promise<void> {
  // 1. Create inventory_batches table
  const hasBatchesTable = await knex.schema.hasTable('inventory_batches');
  if (!hasBatchesTable) {
    await knex.schema.createTable('inventory_batches', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table
        .uuid('purchase_invoice_item_id')
        .nullable()
        .references('id')
        .inTable('purchase_invoice_items')
        .onDelete('SET NULL');
      table.string('batch_number', 50).notNullable();
      table.decimal('initial_qty', 14, 4).notNullable().defaultTo(0);
      table.decimal('remaining_qty', 14, 4).notNullable().defaultTo(0);
      table.decimal('buy_price_per_kg', 14, 2).notNullable().defaultTo(0);
      table.string('selected_unit', 20).notNullable().defaultTo('Bora');
      table.decimal('actual_weight_per_unit', 14, 4).nullable();
      table.jsonb('batch_unit_conversions').notNullable().defaultTo(DEFAULT_CONVERSIONS);
      table.timestamps(true, true);

      table.index('product_id');
      table.index('purchase_invoice_item_id');
      table.index('remaining_qty');
    });
  }

  // 2. Add batch_unit_conversions to purchase_invoice_items if missing
  const hasItemConversions = await knex.schema.hasColumn('purchase_invoice_items', 'batch_unit_conversions');
  if (!hasItemConversions) {
    await knex.schema.alterTable('purchase_invoice_items', (table) => {
      table.jsonb('batch_unit_conversions').nullable();
    });
  }

  // 3. Add batch_id foreign key to sales_invoice_items
  const hasSaleBatchId = await knex.schema.hasColumn('sales_invoice_items', 'batch_id');
  if (!hasSaleBatchId) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table
        .uuid('batch_id')
        .nullable()
        .references('id')
        .inTable('inventory_batches')
        .onDelete('SET NULL');
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

  const hasItemConversions = await knex.schema.hasColumn('purchase_invoice_items', 'batch_unit_conversions');
  if (hasItemConversions) {
    await knex.schema.alterTable('purchase_invoice_items', (table) => {
      table.dropColumn('batch_unit_conversions');
    });
  }

  await knex.schema.dropTableIfExists('inventory_batches');
}
