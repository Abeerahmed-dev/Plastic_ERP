import { z } from 'zod';

export const purchaseItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().min(0.0001, 'Quantity must be greater than 0').optional(),
  quantity_kg: z.number().min(0.0001, 'Quantity KG must be greater than 0').optional(),
  selected_unit: z.string().optional().default('KG'),
  unit_price: z.number().min(0, 'Unit price cannot be negative').optional(),
  price_per_kg: z.number().min(0, 'Price per KG cannot be negative').optional(),
  actual_weight_per_unit: z.number().min(0).optional().nullable(),
  actual_kanta_wt: z.number().min(0).optional().nullable(),
  actual_weight_kg: z.number().min(0).optional().nullable(),
  actualWeightOverride: z.number().min(0).optional().nullable(),
  total: z.number().min(0).optional(),
  total_price: z.number().min(0).optional(),
}).refine(data => data.quantity !== undefined || data.quantity_kg !== undefined, {
  message: "Quantity (KG) is required",
});

export const createPurchaseInvoiceSchema = z.object({
  supplier_id: z.string().uuid('Invalid supplier ID'),
  date: z.string(), // ISO date string
  due_date: z.string().optional(),
  discount: z.number().min(0).default(0),
  advance_applied_amount: z.number().min(0).optional().default(0),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
});

export const updatePurchaseInvoiceSchema = z.object({
  status: z.enum(['UNPAID', 'PARTIAL', 'PAID']).optional(),
  paid_amount: z.number().min(0).optional(),
});

export const returnItemSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  return_quantity: z.number().min(0.0001, 'Return quantity must be greater than 0').optional(),
  quantity: z.number().min(0.0001, 'Quantity must be greater than 0').optional(),
}).refine(data => (data.return_quantity !== undefined && data.return_quantity > 0) || (data.quantity !== undefined && data.quantity > 0), {
  message: 'Return quantity is required and must be greater than 0',
});

export const createPurchaseReturnSchema = z.object({
  parent_invoice_id: z.string().uuid('Invalid parent invoice ID').optional(),
  return_reason: z.string().optional(),
  items: z.array(returnItemSchema).optional(),
  line_items: z.array(returnItemSchema).optional(),
}).refine(data => (data.items && data.items.length > 0) || (data.line_items && data.line_items.length > 0), {
  message: 'At least one returned item is required',
});
