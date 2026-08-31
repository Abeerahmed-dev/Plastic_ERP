import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('customers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    // Server-generated: CUST-0001, CUST-0002, …
    table.string('code', 20).notNullable().unique();
    table.string('name', 150).notNullable();
    table.string('phone', 30).nullable();
    table.string('email', 255).nullable();
    table.text('address').nullable();
    table.string('city', 100).nullable();
    table.string('region', 50).nullable();
    // Informational only in Session 03; enforced in Session 08 (Credit Sales)
    table.decimal('credit_limit', 12, 2).notNullable().defaultTo(0);
    // Historical balance at system go-live. NOT updated directly after that.
    // Outstanding = opening_balance + Σ(sales) − Σ(payments) − Σ(returns)
    table.decimal('opening_balance', 12, 2).notNullable().defaultTo(0);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.text('notes').nullable();
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('name');
    table.index('code');
    table.index('is_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('customers');
}
