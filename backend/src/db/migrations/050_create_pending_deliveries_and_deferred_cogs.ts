import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Upgrade sales_invoice_items with deferred fulfillment & COGS tracking columns
  const hasIsDeferred = await knex.schema.hasColumn('sales_invoice_items', 'is_deferred');
  if (!hasIsDeferred) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.boolean('is_deferred').notNullable().defaultTo(false);
    });
  }

  const hasEstimatedCogs = await knex.schema.hasColumn('sales_invoice_items', 'estimated_cogs');
  if (!hasEstimatedCogs) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.decimal('estimated_cogs', 14, 4).nullable().defaultTo(0);
    });
  }

  const hasActualCogs = await knex.schema.hasColumn('sales_invoice_items', 'actual_cogs');
  if (!hasActualCogs) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.decimal('actual_cogs', 14, 4).nullable().defaultTo(0);
    });
  }

  // 2. Create pending_deliveries table for Backorder & Rolling Fulfillment Queue
  const hasPendingDeliveries = await knex.schema.hasTable('pending_deliveries');
  if (!hasPendingDeliveries) {
    await knex.schema.createTable('pending_deliveries', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('sales_invoice_id').notNullable().references('id').inTable('sales_invoices').onDelete('CASCADE');
      table.uuid('sales_invoice_item_id').nullable().references('id').inTable('sales_invoice_items').onDelete('CASCADE');
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
      table.uuid('variant_id').nullable().references('id').inTable('products').onDelete('SET NULL');

      table.decimal('pending_qty', 14, 4).notNullable().defaultTo(0);
      table.decimal('fulfilled_qty', 14, 4).notNullable().defaultTo(0);
      table.string('status', 20).notNullable().defaultTo('PENDING');

      table.timestamps(true, true);

      table.index('sales_invoice_id');
      table.index('sales_invoice_item_id');
      table.index('product_id');
      table.index('status');
      table.index('created_at');
    });

    // Add check constraint on status enum values
    await knex.raw(`
      ALTER TABLE pending_deliveries
      ADD CONSTRAINT chk_pending_deliveries_status
      CHECK (status IN ('PENDING', 'PARTIAL', 'FULFILLED'))
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pending_deliveries');

  const hasActualCogs = await knex.schema.hasColumn('sales_invoice_items', 'actual_cogs');
  if (hasActualCogs) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.dropColumn('actual_cogs');
    });
  }

  const hasEstimatedCogs = await knex.schema.hasColumn('sales_invoice_items', 'estimated_cogs');
  if (hasEstimatedCogs) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.dropColumn('estimated_cogs');
    });
  }

  const hasIsDeferred = await knex.schema.hasColumn('sales_invoice_items', 'is_deferred');
  if (hasIsDeferred) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.dropColumn('is_deferred');
    });
  }
}
