import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add unit conversion matrix fields to products table
  await knex.schema.alterTable('products', (table) => {
    table.string('base_unit', 20).notNullable().defaultTo('KG');
    table.string('purchase_unit', 20).notNullable().defaultTo('Bora');
    table.string('sale_unit', 20).notNullable().defaultTo('Dasti');
    table.decimal('default_kg_per_purchase_unit', 12, 4).notNullable().defaultTo(25.00);
    table.decimal('default_sale_units_per_kg', 12, 4).notNullable().defaultTo(2.00);
  });

  // Add actual_weight_kg and net_kg_added fields to purchase_invoice_items table
  await knex.schema.alterTable('purchase_invoice_items', (table) => {
    table.decimal('actual_weight_kg', 14, 4).nullable();
    table.decimal('net_kg_added', 14, 4).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('purchase_invoice_items', (table) => {
    table.dropColumn('actual_weight_kg');
    table.dropColumn('net_kg_added');
  });

  await knex.schema.alterTable('products', (table) => {
    table.dropColumn('base_unit');
    table.dropColumn('purchase_unit');
    table.dropColumn('sale_unit');
    table.dropColumn('default_kg_per_purchase_unit');
    table.dropColumn('default_sale_units_per_kg');
  });
}
