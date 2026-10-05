import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('bank_accounts');
  if (!hasTable) {
    await knex.schema.createTable('bank_accounts', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('account_title', 150).notNullable();
      table.string('bank_name', 150).notNullable();
      table.string('account_number', 100).notNullable();
      table.string('iban_details', 150).nullable();
      table.decimal('initial_balance', 15, 2).notNullable().defaultTo(0.00);
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamps(true, true);
    });

    // Seed default primary bank account if empty
    await knex('bank_accounts').insert({
      account_title: 'Primary Business Account',
      bank_name: 'Main Commercial Bank',
      account_number: '000000000000',
      initial_balance: 0.00,
      is_active: true,
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('bank_accounts');
  if (hasTable) {
    await knex.schema.dropTable('bank_accounts');
  }
}
