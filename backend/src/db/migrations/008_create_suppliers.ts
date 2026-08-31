import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('suppliers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    // Server-generated: SUPP-0001, SUPP-0002, …
    table.string('code', 20).notNullable().unique();
    table.string('name', 150).notNullable();
    table.string('phone', 30).nullable();
    table.string('email', 255).nullable();
    table.text('address').nullable();
    table.string('city', 100).nullable();
    table.string('region', 50).nullable();
    // Net payment terms in days
    table.integer('payment_terms').notNullable().defaultTo(30);
    // Historical payable at system go-live. NOT updated directly after that.
    // Outstanding = opening_payable + Σ(purchases) − Σ(payments) − Σ(supplier returns)
    table.decimal('opening_payable', 12, 2).notNullable().defaultTo(0);
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
  await knex.schema.dropTableIfExists('suppliers');
}
