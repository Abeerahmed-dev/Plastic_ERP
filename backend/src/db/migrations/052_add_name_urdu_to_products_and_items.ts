import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasProductNameUrdu = await knex.schema.hasColumn('products', 'name_urdu');
  if (!hasProductNameUrdu) {
    await knex.schema.alterTable('products', (table) => {
      table.string('name_urdu', 255).nullable();
    });
  }

  const hasItemNameUrdu = await knex.schema.hasColumn('sales_invoice_items', 'name_urdu');
  if (!hasItemNameUrdu) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.string('name_urdu', 255).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasItemNameUrdu = await knex.schema.hasColumn('sales_invoice_items', 'name_urdu');
  if (hasItemNameUrdu) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.dropColumn('name_urdu');
    });
  }

  const hasProductNameUrdu = await knex.schema.hasColumn('products', 'name_urdu');
  if (hasProductNameUrdu) {
    await knex.schema.alterTable('products', (table) => {
      table.dropColumn('name_urdu');
    });
  }
}
