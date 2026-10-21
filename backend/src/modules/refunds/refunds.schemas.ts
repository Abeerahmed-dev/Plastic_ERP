import { z } from 'zod';

export const createCustomerRefundSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().positive('Amount must be greater than 0')
  ),
  payment_date: z.string().optional(),
  refund_date: z.string().optional(),
  date: z.string().optional(),
  source: z.string().default('CASH_DRAWER'), // 'CASH_DRAWER' | 'CASH' or bank account UUID
  notes: z.string().optional().nullable(),
  linked_invoice_id: z.string().uuid().optional().nullable(),
  source_id: z.string().optional().nullable(),
  source_type: z.enum(['OVERPAID_INVOICE', 'ADVANCE', 'OVERPAYMENT']).optional().nullable(),
});

export const createSupplierRefundSchema = z.object({
  supplier_id: z.string().uuid('Invalid supplier ID'),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().positive('Amount must be greater than 0')
  ),
  payment_date: z.string().optional(),
  refund_date: z.string().optional(),
  date: z.string().optional(),
  source: z.string().default('CASH_DRAWER'), // 'CASH_DRAWER' | 'CASH' or bank account UUID
  notes: z.string().optional().nullable(),
  purchase_invoice_id: z.string().uuid().optional().nullable(),
  source_id: z.string().optional().nullable(),
  source_type: z.enum(['OVERPAID_INVOICE', 'ADVANCE', 'OVERPAYMENT']).optional().nullable(),
});

export const createRefundSchema = z.object({
  entity_type: z.enum(['customer', 'supplier', 'CUSTOMER', 'SUPPLIER']).optional(),
  customer_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().positive('Amount must be greater than 0')
  ),
  payment_date: z.string().optional(),
  refund_date: z.string().optional(),
  date: z.string().optional(),
  source: z.string().default('CASH_DRAWER'),
  notes: z.string().optional().nullable(),
  source_id: z.string().optional().nullable(),
  source_type: z.enum(['OVERPAID_INVOICE', 'ADVANCE', 'OVERPAYMENT']).optional().nullable(),
});

export type CreateCustomerRefundInput = z.infer<typeof createCustomerRefundSchema>;
export type CreateSupplierRefundInput = z.infer<typeof createSupplierRefundSchema>;
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
