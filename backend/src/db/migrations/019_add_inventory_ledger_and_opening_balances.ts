import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Ensure opening_balance column on customers table
  const hasCustomerOpeningBal = await knex.schema.hasColumn('customers', 'opening_balance');
  if (!hasCustomerOpeningBal) {
    await knex.schema.alterTable('customers', (table) => {
      table.decimal('opening_balance', 12, 2).notNullable().defaultTo(0);
    });
  }

  // 2. Ensure opening_balance & opening_payable columns on suppliers table
  const hasSupplierOpeningBal = await knex.schema.hasColumn('suppliers', 'opening_balance');
  if (!hasSupplierOpeningBal) {
    await knex.schema.alterTable('suppliers', (table) => {
      table.decimal('opening_balance', 12, 2).notNullable().defaultTo(0);
    });
  }

  const hasSupplierOpeningPayable = await knex.schema.hasColumn('suppliers', 'opening_payable');
  if (!hasSupplierOpeningPayable) {
    await knex.schema.alterTable('suppliers', (table) => {
      table.decimal('opening_payable', 12, 2).notNullable().defaultTo(0);
    });
  }

  // 3. Create inventory_transactions (inventory ledger) table
  const hasInventoryTable = await knex.schema.hasTable('inventory_transactions');
  if (!hasInventoryTable) {
    await knex.schema.createTable('inventory_transactions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
      table
        .enum('transaction_type', ['OPENING_STOCK', 'PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN'])
        .notNullable();
      table.decimal('quantity_kg', 12, 4).notNullable().defaultTo(0);
      table.decimal('unit_cost', 12, 2).notNullable().defaultTo(0);
      table.decimal('total_asset_value', 12, 2).notNullable().defaultTo(0);
      table.decimal('capital_equity_value', 12, 2).notNullable().defaultTo(0);
      table.text('notes').nullable();
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index('product_id');
      table.index('transaction_type');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('inventory_transactions');
}
