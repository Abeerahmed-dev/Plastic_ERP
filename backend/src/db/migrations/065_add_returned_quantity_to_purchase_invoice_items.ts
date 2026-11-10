import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('purchase_invoice_items', 'returned_quantity');
  if (!hasCol) {
    await knex.schema.alterTable('purchase_invoice_items', (table) => {
      table.decimal('returned_quantity', 14, 4).notNullable().defaultTo(0);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('purchase_invoice_items', 'returned_quantity');
  if (hasCol) {
    await knex.schema.alterTable('purchase_invoice_items', (table) => {
      table.dropColumn('returned_quantity');
    });
  }
}

