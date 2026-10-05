import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('products', 'fixed_retail_price_per_kg');
  if (!hasCol) {
    await knex.schema.alterTable('products', (table) => {
      table.decimal('fixed_retail_price_per_kg', 12, 2).notNullable().defaultTo(0.00);
    });
  }

  // Populate fixed_retail_price_per_kg for existing products
  const products = await knex('products').select('id', 'sale_price', 'cost_price', 'rolling_avg_cost_per_kg');
  for (const p of products) {
    const salePrice = Number(p.sale_price || 0);
    const costPrice = Number(p.rolling_avg_cost_per_kg || p.cost_price || 0);
    const fixedPrice = salePrice > 0 ? salePrice : (costPrice > 0 ? Math.round(costPrice * 1.15 * 100) / 100 : 150.00);

    await knex('products')
      .where('id', p.id)
      .update({ fixed_retail_price_per_kg: fixedPrice });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('products', 'fixed_retail_price_per_kg');
  if (hasCol) {
    await knex.schema.alterTable('products', (table) => {
      table.dropColumn('fixed_retail_price_per_kg');
    });
  }
}
