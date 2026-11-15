import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Ensure opening_balance column on bank_accounts
  const hasOpeningBalance = await knex.schema.hasColumn('bank_accounts', 'opening_balance');
  if (!hasOpeningBalance) {
    await knex.schema.alterTable('bank_accounts', (table) => {
      table.decimal('opening_balance', 15, 2).notNullable().defaultTo(0.00);
    });
  }

  // 2. Synchronize opening_balance with initial_balance
  await knex.raw(`
    UPDATE bank_accounts
    SET opening_balance = COALESCE(initial_balance, 0.00)
    WHERE opening_balance = 0.00 AND COALESCE(initial_balance, 0.00) > 0
  `);

  // 3. Synchronize current_balance where current_balance is 0 but initial/opening balance exists
  await knex.raw(`
    UPDATE bank_accounts
    SET current_balance = COALESCE(opening_balance, initial_balance, 0.00)
    WHERE current_balance = 0.00 AND (COALESCE(initial_balance, 0.00) > 0 OR COALESCE(opening_balance, 0.00) > 0)
  `);
}

export async function down(knex: Knex): Promise<void> {
  const hasOpeningBalance = await knex.schema.hasColumn('bank_accounts', 'opening_balance');
  if (hasOpeningBalance) {
    await knex.schema.alterTable('bank_accounts', (table) => {
      table.dropColumn('opening_balance');
    });
  }
}
