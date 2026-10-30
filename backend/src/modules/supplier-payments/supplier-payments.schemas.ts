import { z } from 'zod';

export const createSupplierPaymentSchema = z.object({
  supplier_id: z.string().uuid({ message: 'Invalid supplier ID' }),
  purchase_invoice_id: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().uuid({ message: 'Invalid purchase invoice ID' }).optional().nullable()
  ),
  payment_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  amount: z.preprocess((val) => {
    if (typeof val === 'string') {
      const clean = val.replace(/,/g, '').trim();
      return clean === '' ? 0 : Number(clean);
    }
    return Number(val);
  }, z.number().positive({ message: 'Amount must be greater than 0' })),
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'PDC', 'SPLIT']).optional().default('BANK_TRANSFER'),
  bank_account_id: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().uuid({ message: 'Invalid bank account ID' }).optional().nullable()
  ),
  split_cash_amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().min(0).optional()
  ),
  split_bank_amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().min(0).optional()
  ),
  notes: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  cheque_number: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  cheque_bank_name: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  cheque_due_date: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  cheque_status: z.enum(['PENDING', 'CLEARED', 'BOUNCED']).optional().nullable(),
}).superRefine((data, ctx) => {
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

export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;

export const paymentQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  supplier_id: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().uuid({ message: 'Invalid supplier ID' }).optional()
  ),
  purchase_invoice_id: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().uuid({ message: 'Invalid purchase invoice ID' }).optional()
  ),
});

export type PaymentQuery = z.infer<typeof paymentQuerySchema>;
