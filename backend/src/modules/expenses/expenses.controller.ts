import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import { createExpenseSchema, payExpenseSchema, expenseQuerySchema } from './expenses.schemas';
import * as expensesService from './expenses.service';

export async function createExpenseController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload = createExpenseSchema.parse(req.body);
    const userId = req.user?.id;
    const expense = await expensesService.addExpense(payload, userId);
    res.status(201).json(ok(expense));
  } catch (err) {
    next(err);
  }
}

export async function payExpenseController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload = payExpenseSchema.parse(req.body);
    const userId = req.user?.id;
    const updated = await expensesService.payExpense(req.params.id, payload, userId);
    res.status(200).json(ok(updated));
  } catch (err) {
    next(err);
  }
}

export async function listOutstandingExpensesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const outstanding = await expensesService.listOutstandingExpenses(category);
    res.status(200).json(ok(outstanding));
  } catch (err) {
    next(err);
  }
}

export async function listExpensesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = expenseQuerySchema.parse(req.query);
    const expenses = await expensesService.listExpenses(query);
    res.status(200).json(ok(expenses));
  } catch (err) {
    next(err);
  }
}

export async function deleteExpenseController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await expensesService.removeExpense(req.params.id);
    res.status(200).json(ok({ message: 'Expense deleted successfully' }));
  } catch (err) {
    next(err);
  }
}
