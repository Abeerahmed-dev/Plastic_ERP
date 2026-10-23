import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'Salaries',
  'Utilities',
  'Logistics',
  'Petty Cash',
  'Tea & Refreshments',
  'Maintenance',
  'Rent',
  'Other',
] as const;

export const createExpenseSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required').default('Other'),
  description: z.string().optional().nullable(),
  expense_date: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  payment_method: z.string().optional().default('BANK'),
  bank_account_id: z.string().optional().nullable(),
});

export const expenseQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  category: z.string().optional(),
  payment_method: z.string().optional(),
  bank_account_id: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ExpenseQuery = z.infer<typeof expenseQuerySchema>;
