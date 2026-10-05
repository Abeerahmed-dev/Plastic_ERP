import { z } from 'zod';

export const purchaseItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().min(0.0001, 'Quantity must be greater than 0'),
  selected_unit: z.string().optional().default('Bag'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
  actual_weight_per_unit: z.number().min(0).optional().nullable(),
  actual_kanta_wt: z.number().min(0).optional().nullable(),
  actual_weight_kg: z.number().min(0).optional().nullable(),
  actualWeightOverride: z.number().min(0).optional().nullable(),
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
