import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Add PDC cheque columns to customer_payments table
  const hasCustChqNum = await knex.schema.hasColumn('customer_payments', 'cheque_number');
  if (!hasCustChqNum) {
    await knex.schema.alterTable('customer_payments', (table) => {
      table.string('cheque_number', 100).nullable();
      table.string('cheque_bank_name', 150).nullable();
      table.date('cheque_due_date').nullable();
      table.string('cheque_status', 30).notNullable().defaultTo('PENDING');
      
      table.index('cheque_status');
    });
  }

  // 2. Add PDC cheque columns to supplier_payments table
  const hasSuppChqNum = await knex.schema.hasColumn('supplier_payments', 'cheque_number');
  if (!hasSuppChqNum) {
    await knex.schema.alterTable('supplier_payments', (table) => {
      table.string('cheque_number', 100).nullable();
      table.string('cheque_bank_name', 150).nullable();
      table.date('cheque_due_date').nullable();
      table.string('cheque_status', 30).notNullable().defaultTo('PENDING');

      table.index('cheque_status');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCustChqNum = await knex.schema.hasColumn('customer_payments', 'cheque_number');
  if (hasCustChqNum) {
    await knex.schema.alterTable('customer_payments', (table) => {
      table.dropColumn('cheque_number');
      table.dropColumn('cheque_bank_name');
      table.dropColumn('cheque_due_date');
      table.dropColumn('cheque_status');
    });
  }

  const hasSuppChqNum = await knex.schema.hasColumn('supplier_payments', 'cheque_number');
  if (hasSuppChqNum) {
    await knex.schema.alterTable('supplier_payments', (table) => {
      table.dropColumn('cheque_number');
      table.dropColumn('cheque_bank_name');
      table.dropColumn('cheque_due_date');
      table.dropColumn('cheque_status');
    });
  }
}
