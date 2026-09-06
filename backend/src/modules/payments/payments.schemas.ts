import { z } from 'zod';

export const createPaymentSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  invoice_id: z.string().uuid().optional().nullable(),
  payment_date: z.string(), // ISO date string
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  payment_method: z.enum(['CASH', 'BANK', 'PDC', 'BANK_TRANSFER', 'CHEQUE']),
  notes: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
