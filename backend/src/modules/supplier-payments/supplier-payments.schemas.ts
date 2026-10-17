import { z } from 'zod';

export const createSupplierPaymentSchema = z.object({
  supplier_id: z.string().uuid({ message: 'Invalid supplier ID' }),
  purchase_invoice_id: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().uuid({ message: 'Invalid purchase invoice ID' }).optional().nullable()
  ),
  payment_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : Number(val)),
    z.number().positive({ message: 'Amount must be greater than 0' })
  ),
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'PDC']),
  bank_account_id: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().uuid({ message: 'Invalid bank account ID' }).optional().nullable()
  ),
  notes: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  cheque_number: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  cheque_bank_name: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  cheque_due_date: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  cheque_status: z.enum(['PENDING', 'CLEARED', 'BOUNCED']).optional().nullable(),
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
