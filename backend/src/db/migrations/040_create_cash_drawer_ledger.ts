import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('cash_drawer_ledger');
  if (!hasTable) {
    await knex.schema.createTable('cash_drawer_ledger', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('type', 20).notNullable(); // 'INFLOW', 'OUTFLOW'
      table.decimal('amount', 15, 2).notNullable();
      table.string('description', 255).notNullable();
      table.uuid('reference_id').nullable();
      table.date('transaction_date').notNullable().defaultTo(knex.fn.now());
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index('type');
      table.index('transaction_date');
      table.index('reference_id');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cash_drawer_ledger');
}
