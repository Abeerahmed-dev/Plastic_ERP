import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCreditLimit = await knex.schema.hasColumn('customers', 'credit_limit');
  if (!hasCreditLimit) {
    await knex.schema.alterTable('customers', (table) => {
      table.decimal('credit_limit', 15, 2).notNullable().defaultTo(0.00);
    });
  }

  const hasEmail = await knex.schema.hasColumn('customers', 'email');
  if (!hasEmail) {
    await knex.schema.alterTable('customers', (table) => {
      table.string('email', 255).nullable();
    });
  }

  const hasNotes = await knex.schema.hasColumn('customers', 'notes');
  if (!hasNotes) {
    await knex.schema.alterTable('customers', (table) => {
      table.text('notes').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasNotes = await knex.schema.hasColumn('customers', 'notes');
  if (hasNotes) {
    await knex.schema.alterTable('customers', (table) => {
      table.dropColumn('notes');
    });
  }

  const hasEmail = await knex.schema.hasColumn('customers', 'email');
  if (hasEmail) {
    await knex.schema.alterTable('customers', (table) => {
      table.dropColumn('email');
    });
  }

  const hasCreditLimit = await knex.schema.hasColumn('customers', 'credit_limit');
  if (hasCreditLimit) {
    await knex.schema.alterTable('customers', (table) => {
      table.dropColumn('credit_limit');
    });
  }
}
