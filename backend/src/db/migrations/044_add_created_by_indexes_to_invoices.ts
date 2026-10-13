import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Ensure index on sales_invoices.created_by
  const hasSalesInvoices = await knex.schema.hasTable('sales_invoices');
  if (hasSalesInvoices) {
    const hasCol = await knex.schema.hasColumn('sales_invoices', 'created_by');
    if (hasCol) {
      await knex.schema.alterTable('sales_invoices', (table) => {
        table.index('created_by');
      });
    }
  }

  // Ensure index on purchase_invoices.created_by
  const hasPurchaseInvoices = await knex.schema.hasTable('purchase_invoices');
  if (hasPurchaseInvoices) {
    const hasCol = await knex.schema.hasColumn('purchase_invoices', 'created_by');
    if (hasCol) {
      await knex.schema.alterTable('purchase_invoices', (table) => {
        table.index('created_by');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasSalesInvoices = await knex.schema.hasTable('sales_invoices');
  if (hasSalesInvoices) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.dropIndex('created_by');
    });
  }

  const hasPurchaseInvoices = await knex.schema.hasTable('purchase_invoices');
  if (hasPurchaseInvoices) {
    await knex.schema.alterTable('purchase_invoices', (table) => {
      table.dropIndex('created_by');
    });
  }
}
