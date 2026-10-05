import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCustBankAcc = await knex.schema.hasColumn('customer_payments', 'bank_account_id');
  if (!hasCustBankAcc) {
    await knex.schema.alterTable('customer_payments', (table) => {
      table.uuid('bank_account_id').nullable().references('id').inTable('bank_accounts').onDelete('SET NULL');
      table.index('bank_account_id');
    });
  }

  const hasSuppBankAcc = await knex.schema.hasColumn('supplier_payments', 'bank_account_id');
  if (!hasSuppBankAcc) {
    await knex.schema.alterTable('supplier_payments', (table) => {
      table.uuid('bank_account_id').nullable().references('id').inTable('bank_accounts').onDelete('SET NULL');
      table.index('bank_account_id');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCustBankAcc = await knex.schema.hasColumn('customer_payments', 'bank_account_id');
  if (hasCustBankAcc) {
    await knex.schema.alterTable('customer_payments', (table) => {
      table.dropColumn('bank_account_id');
    });
  }

  const hasSuppBankAcc = await knex.schema.hasColumn('supplier_payments', 'bank_account_id');
  if (hasSuppBankAcc) {
    await knex.schema.alterTable('supplier_payments', (table) => {
      table.dropColumn('bank_account_id');
    });
  }
}
