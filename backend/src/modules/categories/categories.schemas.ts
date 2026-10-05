import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  bag_weight_kg: z.coerce.number().min(0.0001, 'Bag weight must be greater than 0'),
  description: z.string().optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
