import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('sales_invoices', 'slip_charges');
  if (!hasCol) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.decimal('slip_charges', 12, 2).notNullable().defaultTo(0);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('sales_invoices', 'slip_charges');
  if (hasCol) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.dropColumn('slip_charges');
    });
  }
}

