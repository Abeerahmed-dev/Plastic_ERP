import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('customer_payments', 'linked_invoice_id');
  if (!hasCol) {
    await knex.schema.alterTable('customer_payments', (table) => {
      table.uuid('linked_invoice_id').nullable().references('id').inTable('sales_invoices').onDelete('SET NULL');
      table.index('linked_invoice_id');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('customer_payments', 'linked_invoice_id');
  if (hasCol) {
    await knex.schema.alterTable('customer_payments', (table) => {
      table.dropColumn('linked_invoice_id');
    });
  }
}
