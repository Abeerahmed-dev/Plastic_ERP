import type { Knex } from 'knex';

const DEFAULT_CONVERSIONS = JSON.stringify({
  Bora: 25.0,
  Peti: 15.0,
  Dasti: 0.5,
  Pura: 5.0,
  KG: 1.0,
});

export async function up(knex: Knex): Promise<void> {
  // Add unit_conversions column to products
  await knex.schema.alterTable('products', (table) => {
    table.jsonb('unit_conversions').notNullable().defaultTo(DEFAULT_CONVERSIONS);
  });

  // Add fields to purchase_invoice_items
  await knex.schema.alterTable('purchase_invoice_items', (table) => {
    table.string('selected_unit', 20).notNullable().defaultTo('Bora');
    table.decimal('actual_weight_per_unit', 14, 4).nullable();
    table.decimal('net_kg_processed', 14, 4).nullable();
  });

  // Add fields to sales_invoice_items
  await knex.schema.alterTable('sales_invoice_items', (table) => {
    table.string('selected_unit', 20).notNullable().defaultTo('Dasti');
    table.decimal('actual_weight_per_unit', 14, 4).nullable();
    table.decimal('net_kg_processed', 14, 4).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales_invoice_items', (table) => {
    table.dropColumn('selected_unit');
    table.dropColumn('actual_weight_per_unit');
    table.dropColumn('net_kg_processed');
  });

  await knex.schema.alterTable('purchase_invoice_items', (table) => {
    table.dropColumn('selected_unit');
    table.dropColumn('actual_weight_per_unit');
    table.dropColumn('net_kg_processed');
  });

  await knex.schema.alterTable('products', (table) => {
    table.dropColumn('unit_conversions');
  });
}
