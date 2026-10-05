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
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

