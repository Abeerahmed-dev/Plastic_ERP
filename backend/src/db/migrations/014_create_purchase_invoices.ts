import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('purchase_invoices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    table.uuid('supplier_id').notNullable().references('id').inTable('suppliers').onDelete('RESTRICT');
    
    // Auto-generated sequential invoice number (e.g. PUR-0001)
    table.string('invoice_number', 50).notNullable().unique();
    
    // Invoice date
    table.date('date').notNullable();
    table.date('due_date').nullable();
    
    // Amounts
    table.decimal('subtotal', 14, 2).notNullable().defaultTo(0);
    table.decimal('discount', 14, 2).notNullable().defaultTo(0);
    table.decimal('total_amount', 14, 2).notNullable().defaultTo(0);
    table.decimal('paid_amount', 14, 2).notNullable().defaultTo(0);
    
    // UNPAID, PARTIAL, PAID
    table.string('status', 20).notNullable().defaultTo('UNPAID');
    
    table.text('notes').nullable();
    
    // Tracking
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    // Indexes
    table.index('supplier_id');
    table.index('invoice_number');
    table.index('status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('purchase_invoices');
}
