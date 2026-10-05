import * as expensesRepo from './expenses.repository';
import { CreateExpenseInput, ExpenseQuery } from './expenses.schemas';

export async function addExpense(input: CreateExpenseInput, userId?: string) {
  return await expensesRepo.createExpenseRecord(input, userId);
}

export async function listExpenses(query: ExpenseQuery = {}) {
  return await expensesRepo.findExpenses(query);
}

export async function removeExpense(id: string) {
  return await expensesRepo.deleteExpenseRecord(id);
}
