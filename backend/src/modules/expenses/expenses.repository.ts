import db from '../../db/knex';
import { parseDateFilter } from '../../shared/dateFilter';
import { CreateExpenseInput, ExpenseQuery } from './expenses.schemas';

export async function createExpenseRecord(input: CreateExpenseInput, userId?: string) {
  const [expense] = await db('expenses')
    .insert({
      amount: input.amount,
      category: input.category || 'Other',
      description: input.description || null,
      expense_date: input.expense_date || new Date(),
      payment_method: input.payment_method || 'CASH',
      created_by: userId || null,
    })
    .returning('*');

  return expense;
}

export async function findExpenses(query: ExpenseQuery = {}) {
  const { startDate: sDateObj, endDate: eDateObj } = parseDateFilter(query.startDate, query.endDate);

  let builder = db('expenses as e')
    .leftJoin('users as u', 'e.created_by', 'u.id')
    .select(
      'e.*',
      'u.name as created_by_name'
    )
    .orderBy('e.expense_date', 'desc')
    .orderBy('e.created_at', 'desc');

  if (sDateObj) {
    builder = builder.whereRaw('COALESCE(e.expense_date, e.created_at::date) >= ?', [sDateObj]);
  }
  if (eDateObj) {
    builder = builder.whereRaw('COALESCE(e.expense_date, e.created_at::date) <= ?', [eDateObj]);
  }
  if (query.category) {
    builder = builder.where('e.category', query.category);
  }
  if (query.payment_method) {
    builder = builder.where('e.payment_method', query.payment_method);
  }

  return await builder;
}

export async function findExpenseById(id: string) {
  return db('expenses').where('id', id).first();
}

export async function deleteExpenseRecord(id: string) {
  return db('expenses').where('id', id).del();
}
