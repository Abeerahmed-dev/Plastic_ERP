import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasBatches = await knex.schema.hasTable('inventory_batches');
  if (hasBatches) {
    const hasBuyPrice = await knex.schema.hasColumn('inventory_batches', 'buy_price_per_kg');
    if (!hasBuyPrice) {
      await knex.raw(
        'ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS buy_price_per_kg NUMERIC(14,2) GENERATED ALWAYS AS (batch_buy_price_per_kg) STORED;'
      );
    }

    const hasCreatedDate = await knex.schema.hasColumn('inventory_batches', 'created_date');
    if (!hasCreatedDate) {
      await knex.raw(
        'ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ GENERATED ALWAYS AS (created_at) STORED;'
      );
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasBatches = await knex.schema.hasTable('inventory_batches');
  if (hasBatches) {
    await knex.raw('ALTER TABLE inventory_batches DROP COLUMN IF EXISTS buy_price_per_kg;');
    await knex.raw('ALTER TABLE inventory_batches DROP COLUMN IF EXISTS created_date;');
  }
}
