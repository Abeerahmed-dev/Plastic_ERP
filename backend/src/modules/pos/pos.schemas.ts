import { z } from 'zod';

export const checkoutItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().refine((val) => val !== 0, { message: 'Quantity cannot be zero' }),
  selected_unit: z.string().optional().default('KG'),
  unit_price: z.number().nonnegative(),
});

export const checkoutSchema = z.object({
  customer_id: z.string().uuid().optional(),
  items: z.array(checkoutItemSchema).min(1, 'At least one item is required'),
  discount: z.number().nonnegative().optional().default(0),
  amount_paid: z.number().optional(),
  payment_method: z.string().optional().default('CASH'),
  bank_account_id: z.string().uuid().optional().nullable(),
  split_cash_amount: z.number().min(0).optional(),
  split_bank_amount: z.number().min(0).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const createHeldOrderSchema = z.object({
  reference_note: z.string().optional().default(''),
  customer_id: z.string().uuid().optional().nullable().or(z.literal('')),
  customer_name: z.string().optional().nullable(),
  items: z.array(z.any()).min(1, 'Cart must have at least one item to hold'),
  subtotal: z.number().min(0).optional().default(0),
  discount: z.number().min(0).optional().default(0),
  total_amount: z.number().min(0),
  payment_method: z.string().optional().default('CASH'),
  split_cash_amount: z.number().nullable().optional(),
  split_bank_amount: z.number().nullable().optional(),
  bank_account_id: z.string().uuid().optional().nullable().or(z.literal('')),
  slip_mode: z.string().optional().default('SINGLE'),
});

export type CreateHeldOrderInput = z.infer<typeof createHeldOrderSchema>;

