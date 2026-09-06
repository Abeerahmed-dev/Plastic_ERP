import { z } from 'zod';

export const checkoutItemSchema = z.object({
  product_id: z.string().uuid(),
  batch_id: z.string().uuid().optional().nullable(),
  quantity: z.number().positive(),
  selected_unit: z.string().optional().default('Dasti'),
  unit_price: z.number().nonnegative(),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'At least one item is required'),
  discount: z.number().nonnegative().optional().default(0),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
