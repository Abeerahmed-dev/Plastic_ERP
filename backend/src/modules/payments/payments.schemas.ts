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
    payment_method: z.enum(['CASH', 'BANK', 'PDC', 'BANK_TRANSFER', 'CHEQUE', 'DIRECT_TO_SUPPLIER']),
    bank_account_id: z.string().uuid().optional().nullable(),
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
  });

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
