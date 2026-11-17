import { z } from 'zod';

export const createBankAccountSchema = z.object({
  account_title: z.string().min(1, 'Account title is required').max(150),
  bank_name: z.string().min(1, 'Bank name is required').max(150),
  account_number: z.string().min(1, 'Account number is required').max(100),
  iban_details: z.string().optional().nullable(),
  opening_balance: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().min(0).default(0)
  ).optional(),
  initial_balance: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().default(0)
  ).optional(),
});

export const updateBankAccountSchema = createBankAccountSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;

export const transferFundsSchema = z.object({
  from_account_id: z.string().min(1, 'Source account is required'),
  to_account_id: z.string().min(1, 'Destination account is required'),
  amount: z.preprocess((val) => Number(val), z.number().positive('Transfer amount must be greater than 0')),
  notes: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
});

export type TransferFundsInput = z.infer<typeof transferFundsSchema>;

