import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('purchase_invoice_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.uuid('purchase_invoice_id').notNullable().references('id').inTable('purchase_invoices').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('RESTRICT');
    
    // Storing decimals correctly to avoid precision issues
    table.decimal('quantity', 14, 4).notNullable();
    table.decimal('unit_price', 14, 2).notNullable();
    table.decimal('total_price', 14, 2).notNullable();
    
    table.timestamps(true, true);

    // Indexes
    table.index('purchase_invoice_id');
    table.index('product_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('purchase_invoice_items');
}
