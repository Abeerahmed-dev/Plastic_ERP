import { z } from 'zod';

export const createProductSchema = z.object({
  code: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required').max(150),
  size: z.string({ required_error: 'Size/Variant is compulsory' })
    .trim()
    .min(1, 'Size/Variant is compulsory'),
  low_stock_threshold: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().min(0, 'Low stock threshold cannot be negative').default(0)
  ).optional(),
  description: z.string().optional().nullable(),
  category_id: z.string().uuid('Invalid Category ID'),
  cost_price: z.preprocess((val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)), z.number().min(0).default(0)).optional(),
  historical_wac: z.preprocess((val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? undefined : Number(val)), z.number().min(0)).optional(),
  sale_price: z.preprocess((val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)), z.number().min(0).default(0)).optional(),
  fixed_retail_price_per_kg: z.preprocess((val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)), z.number().min(0).default(0)).optional(),
  opening_stock: z.preprocess((val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)), z.number().min(0).default(0)).optional(),
  opening_stock_kg: z.preprocess((val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? undefined : Number(val)), z.number().min(0)).optional(),
  notes: z.string().optional().nullable(),
});


export const updateProductSchema = createProductSchema
  .omit({ opening_stock: true, opening_stock_kg: true, historical_wac: true }) // Day Zero stock fields are immutable
  .partial()
  .extend({
    is_active: z.boolean().optional(),
  });

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category_id: z.string().optional(),
  category: z.string().optional(),
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
