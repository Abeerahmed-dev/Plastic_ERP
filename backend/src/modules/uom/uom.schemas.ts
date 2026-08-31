import { z } from 'zod';

export const createUOMSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  abbreviation: z.string().min(1, 'Abbreviation is required').max(10),
});

export const updateUOMSchema = createUOMSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type CreateUOMInput = z.infer<typeof createUOMSchema>;
export type UpdateUOMInput = z.infer<typeof updateUOMSchema>;
