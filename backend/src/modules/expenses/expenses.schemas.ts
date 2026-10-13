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

export const createExpenseSchema = z
  .object({
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    category: z.string().min(1, 'Category is required').default('Other'),
    description: z.string().optional().nullable(),
    expense_date: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
    payment_method: z.enum(['CASH', 'BANK', 'CHEQUE', 'Cash in Drawer', 'Bank Account']).optional().default('CASH'),
    bank_account_id: z.string().uuid('Bank Account ID must be a valid UUID').optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const isBank = data.payment_method === 'BANK' || data.payment_method === 'Bank Account';
    if (isBank && !data.bank_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bank Account ID is required',
        path: ['bank_account_id'],
      });
    }
  });

export const expenseQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  category: z.string().optional(),
  payment_method: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ExpenseQuery = z.infer<typeof expenseQuerySchema>;
