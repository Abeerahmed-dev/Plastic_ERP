import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('system_settings');
  if (!exists) {
    await knex.schema.createTable('system_settings', (table) => {
      table.string('key', 100).primary();
      table.jsonb('value').notNullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // Seed default cashier feature access controls
    await knex('system_settings').insert({
      key: 'cashier_feature_access',
      value: JSON.stringify({
        customer_access: false,
        party_access: false,
      }),
      updated_at: new Date(),
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('system_settings');
}

