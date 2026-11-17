import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('bank_transactions');
  if (!hasTable) {
    await knex.schema.createTable('bank_transactions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('bank_account_id').notNullable().references('id').inTable('bank_accounts').onDelete('CASCADE');
      table.string('type', 20).notNullable(); // 'INFLOW', 'OUTFLOW'
      table.decimal('amount', 15, 2).notNullable();
      table.string('description', 255).notNullable();
      table.date('transaction_date').notNullable().defaultTo(knex.fn.now());
      table.string('category', 100).nullable().defaultTo('EQUITY');
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index('bank_account_id');
      table.index('type');
      table.index('transaction_date');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bank_transactions');
}
