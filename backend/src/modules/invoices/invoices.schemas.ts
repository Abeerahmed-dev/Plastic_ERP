import { z } from 'zod';

export const invoiceItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().refine((v) => v !== 0, 'Quantity cannot be 0'),
  selected_unit: z.string().optional().default('KG'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
  actual_weight_per_unit: z.number().min(0).optional().nullable(),
});

export const createInvoiceSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  date: z.string(), // ISO date string
  due_date: z.string().optional(),
  discount: z.number().min(0).optional().default(0),
  delivery_charge: z.number().min(0).optional().default(0),
  advance_applied_amount: z.number().min(0).optional().default(0),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
});

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


