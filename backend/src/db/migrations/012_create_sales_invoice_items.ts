import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sales_invoice_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('invoice_id').notNullable().references('id').inTable('sales_invoices').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    
    table.decimal('quantity', 14, 4).notNullable();
    table.decimal('unit_price', 14, 2).notNullable();
    table.decimal('total_price', 14, 2).notNullable(); // quantity * unit_price
    
    table.timestamps(true, true);

    table.index('invoice_id');
    table.index('product_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sales_invoice_items');
}
