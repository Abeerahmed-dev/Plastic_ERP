import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasWalkInCol = await knex.schema.hasColumn('sales_invoices', 'walk_in_customer_name');
  if (!hasWalkInCol) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.string('walk_in_customer_name', 255).nullable();
    });
  }

  const hasDueDateCol = await knex.schema.hasColumn('sales_invoices', 'due_date');
  if (hasDueDateCol) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.date('due_date').nullable().alter();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasWalkInCol = await knex.schema.hasColumn('sales_invoices', 'walk_in_customer_name');
  if (hasWalkInCol) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.dropColumn('walk_in_customer_name');
    });
  }
}

