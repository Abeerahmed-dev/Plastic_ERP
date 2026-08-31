import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sales_invoices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('customer_id').notNullable().references('id').inTable('customers').onDelete('RESTRICT');
    table.string('invoice_number', 50).notNullable().unique();
    table.date('date').notNullable();
    table.date('due_date').nullable();
    table.decimal('subtotal', 14, 2).notNullable().defaultTo(0);
    table.decimal('discount', 14, 2).notNullable().defaultTo(0);
    table.decimal('total_amount', 14, 2).notNullable().defaultTo(0);
    table.decimal('paid_amount', 14, 2).notNullable().defaultTo(0);
    // ENUM string: DRAFT, UNPAID, PARTIAL, PAID, CANCELLED
    table.string('status', 20).notNullable().defaultTo('UNPAID');
    table.text('notes').nullable();
    
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('customer_id');
    table.index('invoice_number');
    table.index('status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sales_invoices');
}
