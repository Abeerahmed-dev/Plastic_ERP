import { z } from 'zod';

const REGIONS = ['Sindh', 'Punjab', 'KPK', 'Balochistan', 'Other'] as const;

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  region: z.enum(REGIONS).optional().nullable(),
  customer_type: z.enum(['CASH', 'CREDIT']).default('CREDIT'),
  credit_limit: z.coerce.number().min(0).default(0),
  opening_balance: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema
  .omit({ opening_balance: true }) // opening balance is set once at creation
  .partial()
  .extend({
    is_active: z.boolean().optional(),
  });

export const customerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  city: z.string().optional(),
  customer_type: z.enum(['CASH', 'CREDIT']).optional(),
  region: z.enum(REGIONS).optional(),
  is_active: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'false') return false;
      if (v === 'true') return true;
      return undefined;
    }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerQuery = z.infer<typeof customerQuerySchema>;
