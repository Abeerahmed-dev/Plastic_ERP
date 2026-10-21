import db from '../../db/knex';
import { CreateExpenseInput, ExpenseQuery } from './expenses.schemas';

export async function createExpenseRecord(input: CreateExpenseInput, userId?: string) {
  return await db.transaction(async (trx) => {
    const payload = input;
    // Liquidity Wall
    const account = await trx('bank_accounts').where('id', payload.bank_account_id).first();
    if (!account || Number(account.current_balance) < Number(payload.amount)) {
      throw new Error('INSUFFICIENT_LIQUIDITY: Cannot log an expense larger than the account balance.');
    }

    const [expense] = await trx('expenses')
      .insert({
        amount: payload.amount,
        category: payload.category || 'Other',
        description: payload.description || null,
        expense_date: payload.expense_date || new Date(),
        payment_method: payload.payment_method || (account.bank_name ? 'BANK' : 'CASH'),
        bank_account_id: payload.bank_account_id,
        created_by: userId || null,
      })
      .returning('*');

    // Deduct the amount from bank_accounts current balance
    await trx('bank_accounts')
      .where('id', payload.bank_account_id)
      .decrement('current_balance', payload.amount);

    // Insert new row into bank_transactions
    await trx('bank_transactions').insert({
      bank_account_id: payload.bank_account_id,
      transaction_type: 'WITHDRAWAL',
      type: 'OUTFLOW',
      amount: payload.amount,
      source_type: 'OPEX',
      source: 'OPEX',
      reference_id: expense.id,
      description: payload.description || `OPEX Expense: ${payload.category || 'General'}`,
      transaction_date: payload.expense_date || new Date(),
      category: 'OPEX',
      created_by: userId || null,
    });

    return expense;
  });
}

export async function findExpenses(query: ExpenseQuery = {}) {
  let builder = db('expenses as e')
    .leftJoin('users as u', 'e.created_by', 'u.id')
    .leftJoin('bank_accounts as ba', 'e.bank_account_id', 'ba.id')
    .select(
      'e.*',
      'u.name as created_by_name',
      'ba.bank_name',
      'ba.account_title'
    )
    .orderBy('e.expense_date', 'desc')
    .orderBy('e.created_at', 'desc');

  if (query.startDate) {
    const startDateOnly = query.startDate.includes('T') ? query.startDate.split('T')[0] : query.startDate;
    builder = builder.where(function () {
      this.where('e.created_at', '>=', query.startDate!).orWhere('e.expense_date', '>=', startDateOnly);
    });
  }
  if (query.endDate) {
    const endDateOnly = query.endDate.includes('T') ? query.endDate.split('T')[0] : query.endDate;
    builder = builder.where(function () {
      this.where('e.created_at', '<=', query.endDate!).orWhere('e.expense_date', '<=', endDateOnly);
    });
  }
  if (query.category && query.category !== 'All') {
    builder = builder.where('e.category', query.category);
  }
  if (query.payment_method && query.payment_method !== 'All') {
    builder = builder.where('e.payment_method', query.payment_method);
  }
  if (query.bank_account_id && query.bank_account_id !== 'All') {
    builder = builder.where('e.bank_account_id', query.bank_account_id);
  }

  return await builder;
}

export async function findExpenseById(id: string) {
  return db('expenses').where('id', id).first();
}

export async function deleteExpenseRecord(id: string) {
  return await db.transaction(async (trx) => {
    const exp = await trx('expenses').where('id', id).first();
    if (exp) {
      if (exp.bank_account_id && exp.amount) {
        await trx('bank_accounts')
          .where('id', exp.bank_account_id)
          .increment('current_balance', exp.amount);

        await trx('bank_transactions')
          .where('reference_id', id)
          .del();
      }
      return trx('expenses').where('id', id).del();
    }
    return 0;
  });
}
