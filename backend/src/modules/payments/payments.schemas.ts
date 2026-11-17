import { z } from 'zod';

export const createPaymentSchema = z
  .object({
    customer_id: z.string().uuid('Invalid customer ID'),
    supplier_id: z.string().uuid('Invalid supplier ID').optional().nullable(),
    invoice_id: z.string().uuid().optional().nullable(),
    payment_date: z.string(), // ISO date string
    amount: z.preprocess(
      (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
      z.number().min(0.01, 'Amount must be greater than 0')
    ),
    payment_method: z.enum(['CASH', 'BANK', 'PDC', 'BANK_TRANSFER', 'CHEQUE', 'DIRECT_TO_SUPPLIER', 'SPLIT']),
    bank_account_id: z.string().uuid().optional().nullable(),
    split_cash_amount: z.preprocess(
      (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
      z.number().min(0).optional()
    ),
    split_bank_amount: z.preprocess(
      (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
      z.number().min(0).optional()
    ),
    notes: z.string().optional().nullable(),
    cheque_number: z.string().optional().nullable(),
    cheque_bank_name: z.string().optional().nullable(),
    cheque_due_date: z.string().optional().nullable(),
    cheque_status: z.enum(['PENDING', 'CLEARED', 'BOUNCED']).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.payment_method === 'DIRECT_TO_SUPPLIER' && !data.supplier_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['supplier_id'],
        message: 'Supplier selection is required when payment method is Direct to Supplier',
      });
    }
    if (data.payment_method === 'SPLIT') {
      const c = Number(data.split_cash_amount || 0);
      const b = Number(data.split_bank_amount || 0);
      if (c <= 0 && b <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['split_cash_amount'],
          message: 'At least one split amount (Cash or Bank) must be greater than 0',
        });
      }
      if (b > 0 && !data.bank_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bank_account_id'],
          message: 'Bank account selection is required for bank transfer portion',
        });
      }
    }
  });

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
