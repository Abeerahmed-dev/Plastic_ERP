import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Add source column to bank_transactions
  const hasSource = await knex.schema.hasColumn('bank_transactions', 'source');
  if (!hasSource) {
    await knex.schema.alterTable('bank_transactions', (table) => {
      table.string('source', 100).nullable().defaultTo('INTERNAL_TRANSFER');
      table.index('source');
    });
  }

  // 2. Add current_balance column to bank_accounts
  const hasCurrentBalance = await knex.schema.hasColumn('bank_accounts', 'current_balance');
  if (!hasCurrentBalance) {
    await knex.schema.alterTable('bank_accounts', (table) => {
      table.decimal('current_balance', 15, 2).notNullable().defaultTo(0.00);
    });

    // Backfill current_balance from initial_balance
    await knex.raw(`
      UPDATE bank_accounts
      SET current_balance = COALESCE(initial_balance, 0.00)
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasSource = await knex.schema.hasColumn('bank_transactions', 'source');
  if (hasSource) {
    await knex.schema.alterTable('bank_transactions', (table) => {
      table.dropColumn('source');
    });
  }

  const hasCurrentBalance = await knex.schema.hasColumn('bank_accounts', 'current_balance');
  if (hasCurrentBalance) {
    await knex.schema.alterTable('bank_accounts', (table) => {
      table.dropColumn('current_balance');
    });
  }
}
