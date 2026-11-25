import { z } from 'zod';

export const invoiceItemSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  size: z.string().optional().nullable(),
  quantity: z.number().refine((v) => v !== 0, 'Quantity cannot be 0'),
  selected_unit: z.string().optional().default('KG'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
  actual_weight_per_unit: z.number().min(0).optional().nullable(),
  total: z.number().optional(),
  total_price: z.number().optional(),
});


export const paymentSplitSchema = z.object({
  payment_account_id: z.union([z.string(), z.number()]).transform((val) => String(val)),
  amount: z.coerce.number().min(0.01, 'Split amount must be greater than 0'),
});

export const createInvoiceSchema = z
  .object({
    customer_id: z
      .preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.string().uuid('Invalid customer ID').optional())
      .optional()
      .nullable(),
    walk_in_customer_name: z.string().trim().max(255).optional().nullable(),
    date: z.string(), // ISO date string
    due_date: z
      .preprocess((val) => (val === '' || val === undefined ? null : val), z.string().optional().nullable())
      .optional()
      .nullable(),
    discount: z.number().min(0).optional().default(0),
    delivery_charge: z.number().min(0).optional().default(0),
    slip_charges: z.number().min(0).optional().default(2),
    advance_applied_amount: z.number().min(0).optional().default(0),
    notes: z.string().optional().nullable(),
    transport: z.string().trim().optional().nullable(),
    payment_account_id: z.string().optional().nullable(),
    payment_method: z.string().optional().nullable(),
    payment_splits: z.array(paymentSplitSchema).optional().nullable(),
    offline_id: z.string().max(100).optional().nullable(),
    offline_timestamp: z.number().optional().nullable(),
    items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  })
  .refine(
    (data) => {
      const hasCustomerId = !!data.customer_id && String(data.customer_id).trim() !== '';
      const hasWalkInName = !!data.walk_in_customer_name && String(data.walk_in_customer_name).trim() !== '';
      return hasCustomerId || hasWalkInName;
    },
    {
      message: 'Either customer_id or walk_in_customer_name must be provided',
      path: ['customer_id'],
    }
  );

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const salesReturnItemSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  return_quantity: z.number().gt(0, 'Return quantity must be greater than 0'),
});

export const createSalesReturnSchema = z.object({
  return_reason: z.string().min(1, 'Return reason is required'),
  items: z.array(salesReturnItemSchema).min(1, 'At least one item must be returned'),
});

export type CreateSalesReturnInput = z.infer<typeof createSalesReturnSchema>;


