import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    // e.g. "customers:read"
    table.string('name', 100).notNullable().unique();
    // e.g. "customers"
    table.string('module', 50).notNullable();
    // e.g. "read" | "write" | "delete"
    table.string('action', 50).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('permissions');
}
