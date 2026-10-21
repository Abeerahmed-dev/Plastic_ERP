import { Request, Response, NextFunction } from 'express';
import db from '../../db/knex';
import { ok } from '../../shared/apiResponse';
import { createExpenseSchema, expenseQuerySchema } from './expenses.schemas';
import * as expensesService from './expenses.service';

export async function createExpenseController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload = createExpenseSchema.parse(req.body);
    const userId = req.user?.id;

    const expense = await db.transaction(async (trx) => {
      // Phase 1: Liquidity Wall
      const account = await trx('bank_accounts').where('id', payload.bank_account_id).first();
      if (!account || Number(account.current_balance) < Number(payload.amount)) {
        throw new Error('INSUFFICIENT_LIQUIDITY: Cannot log an expense larger than the account balance.');
      }

      // Relational Binding: insert into expenses / operating_expenses
      const [newExpense] = await trx('expenses')
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

      // Phase 2: Core Ledger Synchronization
      // Deduct the amount from the bank_accounts current balance
      await trx('bank_accounts')
        .where('id', payload.bank_account_id)
        .decrement('current_balance', payload.amount);

      // Insert a new row into bank_transactions
      await trx('bank_transactions').insert({
        bank_account_id: payload.bank_account_id,
        transaction_type: 'WITHDRAWAL',
        type: 'OUTFLOW',
        amount: payload.amount,
        source_type: 'OPEX',
        source: 'OPEX',
        reference_id: newExpense.id,
        description: payload.description || `OPEX Expense: ${payload.category || 'General'}`,
        transaction_date: payload.expense_date || new Date(),
        category: 'OPEX',
        created_by: userId || null,
      });

      return newExpense;
    });

    res.status(201).json(ok(expense));
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
