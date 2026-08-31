import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('products', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    // Server-generated: PROD-0001, PROD-0002, …
    table.string('code', 20).notNullable().unique();
    table.string('name', 150).notNullable();
    table.text('description').nullable();
    table.string('category', 50).notNullable();
    
    // Foreign key to units_of_measure
    table.uuid('uom_id').notNullable().references('id').inTable('units_of_measure').onDelete('RESTRICT');
    
    table.decimal('cost_price', 12, 2).notNullable().defaultTo(0);
    table.decimal('sale_price', 12, 2).notNullable().defaultTo(0);
    
    // Historical stock at system go-live. NOT updated directly after creation.
    // current_stock = opening_stock + Σ(stock_in) − Σ(stock_out)
    table.decimal('opening_stock', 12, 4).notNullable().defaultTo(0);
    
    table.boolean('is_active').notNullable().defaultTo(true);
    table.text('notes').nullable();
    
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index('name');
    table.index('code');
    table.index('category');
    table.index('is_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('products');
}
