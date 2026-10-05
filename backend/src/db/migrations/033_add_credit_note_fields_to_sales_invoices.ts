import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasParentInvoiceId = await knex.schema.hasColumn('sales_invoices', 'parent_invoice_id');
  if (!hasParentInvoiceId) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.uuid('parent_invoice_id').nullable().references('id').inTable('sales_invoices').onDelete('SET NULL');
      table.index('parent_invoice_id');
    });
  }

  const hasInvoiceType = await knex.schema.hasColumn('sales_invoices', 'invoice_type');
  if (!hasInvoiceType) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.string('invoice_type', 30).notNullable().defaultTo('SALE');
      table.index('invoice_type');
    });
  }

  const hasReturnReason = await knex.schema.hasColumn('sales_invoices', 'return_reason');
  if (!hasReturnReason) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.string('return_reason', 255).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sales_invoices', (table) => {
    table.dropColumn('parent_invoice_id');
    table.dropColumn('invoice_type');
    table.dropColumn('return_reason');
  });
}
