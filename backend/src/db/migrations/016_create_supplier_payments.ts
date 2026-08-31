import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('supplier_payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('supplier_id').notNullable().references('id').inTable('suppliers').onDelete('RESTRICT');
    
    // Optional: a payment can be directly linked to a specific purchase invoice
    table.uuid('purchase_invoice_id').nullable().references('id').inTable('purchase_invoices').onDelete('SET NULL');
    
    table.string('payment_number', 50).notNullable().unique();
    table.date('payment_date').notNullable();
    table.decimal('amount', 14, 2).notNullable();
    
    // ENUM string: CASH, BANK_TRANSFER, CHEQUE
    table.string('payment_method', 50).notNullable().defaultTo('CASH');
    table.text('notes').nullable();
    
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('supplier_id');
    table.index('purchase_invoice_id');
    table.index('payment_number');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('supplier_payments');
}
