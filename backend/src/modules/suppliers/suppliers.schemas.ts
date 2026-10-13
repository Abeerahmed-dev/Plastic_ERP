import { z } from 'zod';

const REGIONS = [
  'Sindh',
  'Punjab',
  'Khyber Pakhtunkhwa',
  'KPK',
  'Balochistan',
  'Islamabad Capital Territory',
  'Other',
] as const;

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  region: z.enum(REGIONS).optional().nullable(),
  payment_terms: z.coerce.number().int().min(0).default(30),
  opening_payable: z.coerce.number().min(0).default(0),
  opening_balance: z.coerce.number().min(0).optional(),
  opening_advance: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema
  .omit({ opening_payable: true, opening_balance: true, opening_advance: true })
  .partial()
  .extend({
    is_active: z.boolean().optional(),
  });

export const supplierQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  city: z.string().optional(),
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

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierQuery = z.infer<typeof supplierQuerySchema>;
