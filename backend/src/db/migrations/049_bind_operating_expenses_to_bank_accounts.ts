import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Ensure expenses has bank_account_id referencing bank_accounts
  const hasExpensesBankAcc = await knex.schema.hasColumn('expenses', 'bank_account_id');
  if (!hasExpensesBankAcc) {
    await knex.schema.alterTable('expenses', (table) => {
      table.uuid('bank_account_id').nullable().references('id').inTable('bank_accounts').onDelete('SET NULL');
      table.index('bank_account_id');
    });
  }

  // 2. Ensure bank_transactions has transaction_type, source_type, reference_id
  const hasBankTx = await knex.schema.hasTable('bank_transactions');
  if (hasBankTx) {
    const hasTxType = await knex.schema.hasColumn('bank_transactions', 'transaction_type');
    const hasSourceType = await knex.schema.hasColumn('bank_transactions', 'source_type');
    const hasRefId = await knex.schema.hasColumn('bank_transactions', 'reference_id');

    await knex.schema.alterTable('bank_transactions', (table) => {
      if (!hasTxType) {
        table.string('transaction_type', 50).nullable().defaultTo('WITHDRAWAL');
        table.index('transaction_type');
      }
      if (!hasSourceType) {
        table.string('source_type', 50).nullable().defaultTo('OPEX');
        table.index('source_type');
      }
      if (!hasRefId) {
        table.uuid('reference_id').nullable();
        table.index('reference_id');
      }
    });

    // Make type and description nullable or have defaults to allow flexible inserts
    await knex.raw(`
      ALTER TABLE bank_transactions 
      ALTER COLUMN type DROP NOT NULL,
      ALTER COLUMN type SET DEFAULT 'OUTFLOW',
      ALTER COLUMN description DROP NOT NULL,
      ALTER COLUMN description SET DEFAULT 'OPEX Expense'
    `);
  }

  // 3. Ensure operating_expenses exists as an automatically updatable view over expenses
  await knex.raw(`
    CREATE OR REPLACE VIEW operating_expenses AS 
    SELECT * FROM expenses;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP VIEW IF EXISTS operating_expenses CASCADE;');

  const hasBankTx = await knex.schema.hasTable('bank_transactions');
  if (hasBankTx) {
    const hasTxType = await knex.schema.hasColumn('bank_transactions', 'transaction_type');
    const hasSourceType = await knex.schema.hasColumn('bank_transactions', 'source_type');
    const hasRefId = await knex.schema.hasColumn('bank_transactions', 'reference_id');

    await knex.schema.alterTable('bank_transactions', (table) => {
      if (hasTxType) table.dropColumn('transaction_type');
      if (hasSourceType) table.dropColumn('source_type');
      if (hasRefId) table.dropColumn('reference_id');
    });
  }
}
