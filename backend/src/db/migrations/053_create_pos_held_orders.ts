import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('pos_held_orders');
  if (!hasTable) {
    await knex.schema.createTable('pos_held_orders', (table) => {
      table.uuid('id').primary().defaultTo(knex.fn.uuid());
      table.string('reference_note', 255).notNullable();
      table.uuid('customer_id').nullable().references('id').inTable('customers').onDelete('SET NULL');
      table.string('customer_name', 255).nullable();
      table.jsonb('items').notNullable();
      table.decimal('subtotal', 14, 2).defaultTo(0);
      table.decimal('discount', 14, 2).defaultTo(0);
      table.decimal('total_amount', 14, 2).notNullable();
      table.string('payment_method', 50).defaultTo('CASH');
      table.decimal('split_cash_amount', 14, 2).nullable();
      table.decimal('split_bank_amount', 14, 2).nullable();
      table.uuid('bank_account_id').nullable();
      table.string('slip_mode', 20).defaultTo('SINGLE');
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pos_held_orders');
}
