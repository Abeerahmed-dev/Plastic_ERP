import { z } from 'zod';

export const createSupplierPaymentSchema = z.object({
  supplier_id: z.string().uuid(),
  purchase_invoice_id: z.string().uuid().optional().nullable(),
  payment_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  amount: z.number().positive(),
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE']),
  notes: z.string().optional().nullable(),
});

export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;

export const paymentQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  supplier_id: z.string().uuid().optional(),
  purchase_invoice_id: z.string().uuid().optional(),
});

export type PaymentQuery = z.infer<typeof paymentQuerySchema>;
