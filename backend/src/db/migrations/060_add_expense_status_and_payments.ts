import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasExpenses = await knex.schema.hasTable('expenses');
  if (hasExpenses) {
    const hasStatus = await knex.schema.hasColumn('expenses', 'status');
    const hasPaidAmount = await knex.schema.hasColumn('expenses', 'paid_amount');
    const hasPurchaseId = await knex.schema.hasColumn('expenses', 'purchase_id');

    await knex.schema.alterTable('expenses', (table) => {
      if (!hasStatus) {
        table.string('status', 20).notNullable().defaultTo('PAID');
        table.index('status');
      }
      if (!hasPaidAmount) {
        table.decimal('paid_amount', 14, 2).notNullable().defaultTo(0);
      }
      if (!hasPurchaseId) {
        table.uuid('purchase_id').nullable().references('id').inTable('purchase_invoices').onDelete('SET NULL');
        table.index('purchase_id');
      }
    });
  }

  // Create expense_payments table
  const hasExpensePayments = await knex.schema.hasTable('expense_payments');
  if (!hasExpensePayments) {
    await knex.schema.createTable('expense_payments', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('expense_id').notNullable().references('id').inTable('expenses').onDelete('CASCADE');
      table.decimal('amount', 14, 2).notNullable();
      table.string('payment_method', 50).notNullable().defaultTo('CASH'); // 'CASH' or account name / 'BANK'
      table.uuid('bank_account_id').nullable().references('id').inTable('bank_accounts').onDelete('SET NULL');
      table.date('payment_date').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
      table.text('notes').nullable();
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index('expense_id');
      table.index('payment_date');
      table.index('payment_method');
    });
  }

  // Refresh operating_expenses view to expose the new columns
  await knex.raw('CREATE OR REPLACE VIEW operating_expenses AS SELECT * FROM expenses;');

  // Backfill existing data:
  // 1. Link purchase_invoices.expense_id to expenses.purchase_id
  const purchasesWithExpenses = await knex('purchase_invoices')
    .whereNotNull('expense_id')
    .select('id', 'expense_id');

  for (const pur of purchasesWithExpenses) {
    await knex('expenses')
      .where('id', pur.expense_id)
      .update({ purchase_id: pur.id });
  }

  // 2. Existing purchase delivery charge expenses without cash_drawer_ledger or bank_transactions
  // should be marked as PENDING (unpaid), paid_amount = 0, payment_method = 'UNPAID'
  const allExpenses = await knex('expenses').select('*');
  for (const exp of allExpenses) {
    if (exp.purchase_id) {
      // Check if actual cash outflow was logged
      const cdl = await knex('cash_drawer_ledger').where('reference_id', exp.id).first();
      const btx = await knex('bank_transactions').where('reference_id', exp.id).first();
      if (!cdl && !btx) {
        // Unpaid delivery charge
        await knex('expenses').where('id', exp.id).update({
          status: 'PENDING',
          paid_amount: 0,
          payment_method: 'UNPAID',
        });
        continue;
      }
    }

    // Otherwise it's a historical paid expense
    await knex('expenses').where('id', exp.id).update({
      status: 'PAID',
      paid_amount: exp.amount,
    });

    // Ensure corresponding expense_payments record exists
    const existingPayment = await knex('expense_payments').where('expense_id', exp.id).first();
    if (!existingPayment) {
      await knex('expense_payments').insert({
        expense_id: exp.id,
        amount: exp.amount,
        payment_method: exp.payment_method || 'CASH',
        bank_account_id: exp.bank_account_id || null,
        payment_date: exp.expense_date,
        notes: exp.description || 'Historical expense payment',
        created_by: exp.created_by || null,
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('expense_payments');

  const hasExpenses = await knex.schema.hasTable('expenses');
  if (hasExpenses) {
    const hasPurchaseId = await knex.schema.hasColumn('expenses', 'purchase_id');
    const hasPaidAmount = await knex.schema.hasColumn('expenses', 'paid_amount');
    const hasStatus = await knex.schema.hasColumn('expenses', 'status');

    await knex.schema.alterTable('expenses', (table) => {
      if (hasPurchaseId) table.dropColumn('purchase_id');
      if (hasPaidAmount) table.dropColumn('paid_amount');
      if (hasStatus) table.dropColumn('status');
    });
  }

  await knex.raw('CREATE OR REPLACE VIEW operating_expenses AS SELECT * FROM expenses;');
}

