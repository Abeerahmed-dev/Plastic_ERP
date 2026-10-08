import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('employees');
  if (!exists) {
    await knex.schema.createTable('employees', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('employee_id', 50).notNullable().unique();
      table.string('name', 255).notNullable();
      table.string('phone', 50).nullable();
      table.string('designation', 100).notNullable();
      table.string('store_timing', 100).nullable();
      table.decimal('salary', 12, 2).notNullable().defaultTo(0);
      table.string('cnic', 50).nullable();
      table.string('status', 20).notNullable().defaultTo('ACTIVE');
      table.date('joining_date').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.index('employee_id');
      table.index('name');
      table.index('status');
      table.index('designation');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('employees');
}
