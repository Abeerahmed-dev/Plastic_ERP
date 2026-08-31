import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('customer_payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('customer_id').notNullable().references('id').inTable('customers').onDelete('RESTRICT');
    
    // Optional: a payment can be directly linked to a specific invoice, 
    // or left null if it's a general payment against the customer's account balance.
    table.uuid('invoice_id').nullable().references('id').inTable('sales_invoices').onDelete('SET NULL');
    
    table.string('payment_number', 50).notNullable().unique();
    table.date('payment_date').notNullable();
    table.decimal('amount', 14, 2).notNullable();
    
    // ENUM string: CASH, BANK_TRANSFER, CHEQUE
    table.string('payment_method', 50).notNullable().defaultTo('CASH');
    table.text('notes').nullable();
    
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('customer_id');
    table.index('invoice_id');
    table.index('payment_number');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('customer_payments');
}
