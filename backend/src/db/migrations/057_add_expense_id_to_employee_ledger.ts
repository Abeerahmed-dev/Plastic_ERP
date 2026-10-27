import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('employee_ledger', 'expense_id');
  if (!hasColumn) {
    await knex.schema.alterTable('employee_ledger', (table) => {
      table
        .uuid('expense_id')
        .nullable()
        .references('id')
        .inTable('expenses')
        .onDelete('SET NULL');
      table.index('expense_id');
    });
  }

  // Backfill any existing employee_ledger disbursements that don't have an expense_id yet
  const rows = await knex('employee_ledger as el')
    .leftJoin('employees as emp', 'el.employee_id', 'emp.id')
    .whereIn('el.transaction_type', ['ADVANCE', 'PAYMENT'])
    .whereNull('el.expense_id')
    .select('el.*', 'emp.name as employee_name', 'emp.employee_id as employee_code');

  for (const row of rows) {
    const isBank = row.payment_method === 'BANK_TRANSFER' && row.bank_account_id;
    const [expense] = await knex('expenses')
      .insert({
        amount: row.amount,
        category: 'Salaries',
        description: row.description || `Salary Disbursement for ${row.employee_name || 'Staff'} (${row.reference_month})`,
        expense_date: row.date,
        payment_method: isBank ? 'BANK' : 'CASH',
        bank_account_id: isBank ? row.bank_account_id : null,
        created_by: row.created_by,
      })
      .returning('id');

    if (expense?.id) {
      await knex('employee_ledger')
        .where('id', row.id)
        .update({ expense_id: expense.id });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('employee_ledger', 'expense_id');
  if (hasColumn) {
    await knex.schema.alterTable('employee_ledger', (table) => {
      table.dropColumn('expense_id');
    });
  }
}
