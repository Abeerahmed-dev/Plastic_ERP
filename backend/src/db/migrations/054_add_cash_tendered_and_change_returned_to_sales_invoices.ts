import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCashTendered = await knex.schema.hasColumn('sales_invoices', 'cash_tendered');
  if (!hasCashTendered) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.decimal('cash_tendered', 14, 2).nullable().defaultTo(0);
    });
  }

  const hasChangeReturned = await knex.schema.hasColumn('sales_invoices', 'change_returned');
  if (!hasChangeReturned) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.decimal('change_returned', 14, 2).nullable().defaultTo(0);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasChangeReturned = await knex.schema.hasColumn('sales_invoices', 'change_returned');
  if (hasChangeReturned) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.dropColumn('change_returned');
    });
  }

  const hasCashTendered = await knex.schema.hasColumn('sales_invoices', 'cash_tendered');
  if (hasCashTendered) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.dropColumn('cash_tendered');
    });
  }
}
