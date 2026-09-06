import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Update product defaults for '30/s' (or PROD-0003)
  const product30s = await knex('products')
    .whereILike('name', '%30/s%')
    .orWhere('code', 'PROD-0003')
    .first();

  const customMatrix = JSON.stringify({ Bora: 30.0, Peti: 15.0, KG: 1.0 });

  if (product30s) {
    await knex('products')
      .where({ id: product30s.id })
      .update({
        unit_conversions: customMatrix,
        default_kg_per_purchase_unit: 30.0,
      });
  }

  // Also ensure all existing products have non-null unit_conversions
  await knex('products')
    .whereNull('unit_conversions')
    .update({
      unit_conversions: customMatrix,
    });

  // 2. Purge corrupted sales & customer payments CASCADE to reset Profit Matrix
  await knex.raw('TRUNCATE TABLE sales_invoices, sales_invoice_items, customer_payments CASCADE;');

  // 3. Purge corrupted batches CASCADE
  await knex.raw('TRUNCATE TABLE inventory_batches CASCADE;');
}

export async function down(_knex: Knex): Promise<void> {
  // No-op for data purge rollback
}
