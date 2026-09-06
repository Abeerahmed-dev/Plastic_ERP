import { z } from 'zod';

export const invoiceItemSchema = z.object({
  product_id: z.string().uuid(),
  batch_id: z.string().uuid().optional().nullable(),
  quantity: z.number().min(0.0001, 'Quantity must be greater than 0'),
  selected_unit: z.string().optional().default('Dasti'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
  actual_weight_per_unit: z.number().min(0).optional().nullable(),
});

export const createInvoiceSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  date: z.string(), // ISO date string
  due_date: z.string().optional(),
  discount: z.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
