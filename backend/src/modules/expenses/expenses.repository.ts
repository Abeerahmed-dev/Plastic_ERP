import db from '../../db/knex';
import { CreateExpenseInput, ExpenseQuery } from './expenses.schemas';

export async function createExpenseRecord(input: CreateExpenseInput, userId?: string) {
  let normalizedPaymentMethod = input.payment_method || 'CASH';
  if (normalizedPaymentMethod === 'Cash in Drawer') normalizedPaymentMethod = 'CASH';
  if (normalizedPaymentMethod === 'Bank Account') normalizedPaymentMethod = 'BANK';

  const isBank = normalizedPaymentMethod === 'BANK';
  const bankAccountId = isBank ? (input.bank_account_id || null) : null;

  const [expense] = await db('expenses')
    .insert({
      amount: input.amount,
      category: input.category || 'Other',
      description: input.description || null,
      expense_date: input.expense_date || new Date(),
      payment_method: normalizedPaymentMethod,
      bank_account_id: bankAccountId,
      created_by: userId || null,
    })
    .returning('*');

  return expense;
}

export async function findExpenses(query: ExpenseQuery = {}) {
  let builder = db('expenses as e')
    .leftJoin('users as u', 'e.created_by', 'u.id')
    .select(
      'e.*',
      'u.name as created_by_name'
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
