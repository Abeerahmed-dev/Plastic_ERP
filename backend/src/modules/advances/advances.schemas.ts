import { z } from 'zod';

export const createCustomerAdvanceSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().positive('Amount must be greater than 0')
  ),
  payment_date: z.string().optional(),
  date: z.string().optional(),
  source: z.string().default('CASH_DRAWER'), // 'CASH_DRAWER' | 'CASH' or bank account UUID
  notes: z.string().optional().nullable(),
});

export const createSupplierAdvanceSchema = z.object({
  supplier_id: z.string().uuid('Invalid supplier ID'),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().positive('Amount must be greater than 0')
  ),
  payment_date: z.string().optional(),
  date: z.string().optional(),
  source: z.string().default('CASH_DRAWER'), // 'CASH_DRAWER' | 'CASH' or bank account UUID
  notes: z.string().optional().nullable(),
});

export const createAdvanceSchema = z.object({
  entity_type: z.enum(['customer', 'supplier', 'CUSTOMER', 'SUPPLIER']).optional(),
  customer_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().positive('Amount must be greater than 0')
  ),
  payment_date: z.string().optional(),
  date: z.string().optional(),
  source: z.string().default('CASH_DRAWER'),
  notes: z.string().optional().nullable(),
});

export type CreateCustomerAdvanceInput = z.infer<typeof createCustomerAdvanceSchema>;
export type CreateSupplierAdvanceInput = z.infer<typeof createSupplierAdvanceSchema>;
export type CreateAdvanceInput = z.infer<typeof createAdvanceSchema>;
