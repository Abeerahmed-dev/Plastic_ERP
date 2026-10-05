import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasSize = await knex.schema.hasColumn('products', 'size');
  if (!hasSize) {
    await knex.schema.alterTable('products', (table) => {
      table.string('size').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasSize = await knex.schema.hasColumn('products', 'size');
  if (hasSize) {
    await knex.schema.alterTable('products', (table) => {
      table.dropColumn('size');
    });
  }
}
