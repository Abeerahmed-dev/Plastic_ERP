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
  payment_method: z.string().optional().default('CASH'),
  bank_account_id: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'PAID', 'UNPAID']).optional().default('PAID'),
  purchase_id: z.string().optional().nullable(),
});

export const payExpenseSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  payment_method: z.string().min(1, 'Payment method is required'),
  bank_account_id: z.string().optional().nullable(),
  payment_date: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  notes: z.string().optional().nullable(),
});

export const expenseQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  payment_method: z.string().optional(),
  bank_account_id: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type PayExpenseInput = z.infer<typeof payExpenseSchema>;
export type ExpenseQuery = z.infer<typeof expenseQuerySchema>;
