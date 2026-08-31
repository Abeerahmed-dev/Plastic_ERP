import { z } from 'zod';

const CATEGORIES = ['Plastic Bag', 'Roll', 'Sheet', 'Granules', 'Packaging', 'Other'] as const;

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  description: z.string().optional().nullable(),
  category: z.enum(CATEGORIES),
  uom_id: z.string().uuid('Invalid UOM ID'),
  cost_price: z.coerce.number().min(0).default(0),
  sale_price: z.coerce.number().min(0).default(0),
  opening_stock: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

export const updateProductSchema = createProductSchema
  .omit({ opening_stock: true }) // opening_stock is immutable
  .partial()
  .extend({
    is_active: z.boolean().optional(),
  });

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.enum(CATEGORIES).optional(),
  is_active: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'false') return false;
      if (v === 'true') return true;
      return undefined;
    }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
