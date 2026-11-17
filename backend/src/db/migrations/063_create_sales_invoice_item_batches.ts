import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('sales_invoice_item_batches');
  if (!exists) {
    await knex.schema.createTable('sales_invoice_item_batches', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('sales_invoice_item_id')
        .notNullable()
        .references('id')
        .inTable('sales_invoice_items')
        .onDelete('CASCADE');
      table.uuid('inventory_batch_id')
        .notNullable()
        .references('id')
        .inTable('inventory_batches')
        .onDelete('RESTRICT');
      table.decimal('qty_deducted', 14, 4).notNullable();
      table.decimal('cogs_per_kg', 14, 2).notNullable();
      table.timestamps(true, true);

      table.index('sales_invoice_item_id');
      table.index('inventory_batch_id');
      table.index('created_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sales_invoice_item_batches');
}

