import * as expensesRepo from './expenses.repository';
import { CreateExpenseInput, PayExpenseInput, ExpenseQuery } from './expenses.schemas';

export async function addExpense(input: CreateExpenseInput, userId?: string) {
  return await expensesRepo.createExpenseRecord(input, userId);
}

export async function payExpense(expenseId: string, input: PayExpenseInput, userId?: string) {
  return await expensesRepo.payExpenseRecord(expenseId, input, userId);
}

export async function listOutstandingExpenses(category?: string) {
  return await expensesRepo.findOutstandingExpenses(category);
}

export async function listExpenses(query: ExpenseQuery = {}) {
  return await expensesRepo.findExpenses(query);
}

export async function getExpenseById(id: string) {
  return await expensesRepo.findExpenseById(id);
}

export async function removeExpense(id: string) {
  return await expensesRepo.deleteExpenseRecord(id);
}
