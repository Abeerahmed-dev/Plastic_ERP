import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Add split & overdraft quantity columns to sales_invoice_items
  const hasItemsReq = await knex.schema.hasColumn('sales_invoice_items', 'requested_qty');
  if (!hasItemsReq) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.decimal('requested_qty', 14, 4).notNullable().defaultTo(0);
      table.decimal('fulfilled_qty', 14, 4).notNullable().defaultTo(0);
      table.decimal('deferred_qty', 14, 4).notNullable().defaultTo(0);
    });
  }

  // 2. Add split & overdraft quantity columns and offline lineage to sales_invoices
  const hasInvoicesReq = await knex.schema.hasColumn('sales_invoices', 'requested_qty');
  if (!hasInvoicesReq) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.decimal('requested_qty', 14, 4).notNullable().defaultTo(0);
      table.decimal('fulfilled_qty', 14, 4).notNullable().defaultTo(0);
      table.decimal('deferred_qty', 14, 4).notNullable().defaultTo(0);
      table.string('offline_id', 100).nullable();
      table.bigInteger('offline_timestamp').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasInvoicesReq = await knex.schema.hasColumn('sales_invoices', 'requested_qty');
  if (hasInvoicesReq) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.dropColumn('requested_qty');
      table.dropColumn('fulfilled_qty');
      table.dropColumn('deferred_qty');
      table.dropColumn('offline_id');
      table.dropColumn('offline_timestamp');
    });
  }

  const hasItemsReq = await knex.schema.hasColumn('sales_invoice_items', 'requested_qty');
  if (hasItemsReq) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.dropColumn('requested_qty');
      table.dropColumn('fulfilled_qty');
      table.dropColumn('deferred_qty');
    });
  }
}

