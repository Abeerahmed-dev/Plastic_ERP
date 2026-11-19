import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('sales_invoices', 'transport');
  if (!hasColumn) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.text('transport').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('sales_invoices', 'transport');
  if (hasColumn) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.dropColumn('transport');
    });
  }
}

