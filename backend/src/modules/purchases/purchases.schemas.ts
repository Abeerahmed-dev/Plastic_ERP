import { z } from 'zod';

export const purchaseItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().min(0.0001, 'Quantity must be greater than 0'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
});

export const createPurchaseInvoiceSchema = z.object({
  supplier_id: z.string().uuid('Invalid supplier ID'),
  date: z.string(), // ISO date string
  due_date: z.string().optional(),
  discount: z.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
});

export const updatePurchaseInvoiceSchema = z.object({
  status: z.enum(['UNPAID', 'PARTIAL', 'PAID']).optional(),
  paid_amount: z.number().min(0).optional(),
});
