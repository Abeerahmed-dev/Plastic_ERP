import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('expenses', 'bank_account_id');
  if (!hasCol) {
    await knex.schema.alterTable('expenses', (table) => {
      table.uuid('bank_account_id').nullable().references('id').inTable('bank_accounts').onDelete('SET NULL');
      table.index('bank_account_id');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('expenses', 'bank_account_id');
  if (hasCol) {
    await knex.schema.alterTable('expenses', (table) => {
      table.dropColumn('bank_account_id');
    });
  }
}
