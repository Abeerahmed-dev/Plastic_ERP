import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('cash_drawer_ledger');
  if (hasTable) {
    const hasSourceType = await knex.schema.hasColumn('cash_drawer_ledger', 'source_type');
    if (!hasSourceType) {
      await knex.schema.alterTable('cash_drawer_ledger', (table) => {
        table.string('source_type', 50).nullable().defaultTo('OPEX');
        table.index('source_type');
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('cash_drawer_ledger');
  if (hasTable) {
    const hasSourceType = await knex.schema.hasColumn('cash_drawer_ledger', 'source_type');
    if (hasSourceType) {
      await knex.schema.alterTable('cash_drawer_ledger', (table) => {
        table.dropColumn('source_type');
      });
    }
  }
}

