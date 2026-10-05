import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('expenses');
  if (!exists) {
    await knex.schema.createTable('expenses', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.decimal('amount', 14, 2).notNullable();
      table.string('category', 100).notNullable().defaultTo('Other');
      table.text('description').nullable();
      table.date('expense_date').notNullable();
      table.string('payment_method', 50).notNullable().defaultTo('CASH');
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index('expense_date');
      table.index('category');
      table.index('payment_method');
      table.index('created_by');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('expenses');
}
