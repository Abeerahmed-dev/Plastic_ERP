import { z } from 'zod';

export const invoiceItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().min(0.0001, 'Quantity must be greater than 0'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
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
