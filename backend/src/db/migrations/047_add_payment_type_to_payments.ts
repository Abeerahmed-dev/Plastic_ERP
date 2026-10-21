import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCustPaymentType = await knex.schema.hasColumn('customer_payments', 'payment_type');
  if (!hasCustPaymentType) {
    await knex.schema.alterTable('customer_payments', (table) => {
      table.string('payment_type', 50).nullable().defaultTo('INVOICE_SETTLEMENT');
      table.index('payment_type');
    });
  }

  const hasSuppPaymentType = await knex.schema.hasColumn('supplier_payments', 'payment_type');
  if (!hasSuppPaymentType) {
    await knex.schema.alterTable('supplier_payments', (table) => {
      table.string('payment_type', 50).nullable().defaultTo('INVOICE_SETTLEMENT');
      table.index('payment_type');
    });
  }

  // Update existing CASH_REFUND payments
  await knex('customer_payments')
    .where('payment_method', 'CASH_REFUND')
    .orWhere('amount', '<', 0)
    .update({ payment_type: 'CASH_REFUND' });
}

export async function down(knex: Knex): Promise<void> {
  const hasCustPaymentType = await knex.schema.hasColumn('customer_payments', 'payment_type');
  if (hasCustPaymentType) {
    await knex.schema.alterTable('customer_payments', (table) => {
      table.dropColumn('payment_type');
    });
  }

  const hasSuppPaymentType = await knex.schema.hasColumn('supplier_payments', 'payment_type');
  if (hasSuppPaymentType) {
    await knex.schema.alterTable('supplier_payments', (table) => {
      table.dropColumn('payment_type');
    });
  }
}
