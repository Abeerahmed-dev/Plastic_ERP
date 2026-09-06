import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCreditLimit = await knex.schema.hasColumn('customers', 'credit_limit');
  if (!hasCreditLimit) {
    await knex.schema.alterTable('customers', (table) => {
      table.decimal('credit_limit', 15, 2).notNullable().defaultTo(0.00);
    });
  }

  const hasMinMarkup = await knex.schema.hasColumn('products', 'min_markup_percent');
  if (!hasMinMarkup) {
    await knex.schema.alterTable('products', (table) => {
      table.decimal('min_markup_percent', 5, 2).notNullable().defaultTo(5.00);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasMinMarkup = await knex.schema.hasColumn('products', 'min_markup_percent');
  if (hasMinMarkup) {
    await knex.schema.alterTable('products', (table) => {
      table.dropColumn('min_markup_percent');
    });
  }

  const hasCreditLimit = await knex.schema.hasColumn('customers', 'credit_limit');
  if (hasCreditLimit) {
    await knex.schema.alterTable('customers', (table) => {
      table.dropColumn('credit_limit');
    });
  }
}
