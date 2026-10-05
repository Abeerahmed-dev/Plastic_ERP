import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCustomerType = await knex.schema.hasColumn('customers', 'customer_type');
  if (!hasCustomerType) {
    await knex.schema.alterTable('customers', (table) => {
      table.string('customer_type', 20).notNullable().defaultTo('CREDIT');
      table.index('customer_type');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCustomerType = await knex.schema.hasColumn('customers', 'customer_type');
  if (hasCustomerType) {
    await knex.schema.alterTable('customers', (table) => {
      table.dropColumn('customer_type');
    });
  }
}
