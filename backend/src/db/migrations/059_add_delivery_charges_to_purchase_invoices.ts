import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasDeliveryCharges = await knex.schema.hasColumn('purchase_invoices', 'delivery_charges');
  if (!hasDeliveryCharges) {
    await knex.schema.alterTable('purchase_invoices', (table) => {
      table.decimal('delivery_charges', 14, 2).notNullable().defaultTo(0);
    });
  }

  const hasExpenseId = await knex.schema.hasColumn('purchase_invoices', 'expense_id');
  if (!hasExpenseId) {
    await knex.schema.alterTable('purchase_invoices', (table) => {
      table.uuid('expense_id').nullable().references('id').inTable('expenses').onDelete('SET NULL');
      table.index('expense_id');
    });
  }

  const hasDcPerKg = await knex.schema.hasColumn('purchase_invoice_items', 'delivery_charge_per_kg');
  if (!hasDcPerKg) {
    await knex.schema.alterTable('purchase_invoice_items', (table) => {
      table.decimal('delivery_charge_per_kg', 14, 4).notNullable().defaultTo(0);
    });
  }

  const hasLandedCost = await knex.schema.hasColumn('purchase_invoice_items', 'landed_cost_per_kg');
  if (!hasLandedCost) {
    await knex.schema.alterTable('purchase_invoice_items', (table) => {
      table.decimal('landed_cost_per_kg', 14, 2).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasLandedCost = await knex.schema.hasColumn('purchase_invoice_items', 'landed_cost_per_kg');
  if (hasLandedCost) {
    await knex.schema.alterTable('purchase_invoice_items', (table) => {
      table.dropColumn('landed_cost_per_kg');
    });
  }

  const hasDcPerKg = await knex.schema.hasColumn('purchase_invoice_items', 'delivery_charge_per_kg');
  if (hasDcPerKg) {
    await knex.schema.alterTable('purchase_invoice_items', (table) => {
      table.dropColumn('delivery_charge_per_kg');
    });
  }

  const hasExpenseId = await knex.schema.hasColumn('purchase_invoices', 'expense_id');
  if (hasExpenseId) {
    await knex.schema.alterTable('purchase_invoices', (table) => {
      table.dropColumn('expense_id');
    });
  }

  const hasDeliveryCharges = await knex.schema.hasColumn('purchase_invoices', 'delivery_charges');
  if (hasDeliveryCharges) {
    await knex.schema.alterTable('purchase_invoices', (table) => {
      table.dropColumn('delivery_charges');
    });
  }
}

