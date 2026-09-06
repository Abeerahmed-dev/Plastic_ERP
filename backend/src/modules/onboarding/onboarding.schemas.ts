import { z } from 'zod';

export const customerOnboardingItemSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(150),
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  opening_balance: z.coerce.number().default(0), // Positive means customer owes business money
});

export const bulkCustomersOnboardingSchema = z.object({
  customers: z.array(customerOnboardingItemSchema).min(1, 'At least one customer record is required'),
});

export const supplierOnboardingItemSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(150),
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  opening_balance: z.coerce.number().default(0), // Negative or positive opening payable owed by business
});

export const bulkSuppliersOnboardingSchema = z.object({
  suppliers: z.array(supplierOnboardingItemSchema).min(1, 'At least one supplier record is required'),
});

export const inventoryOnboardingItemSchema = z.object({
  product_id: z.string().uuid('Valid Product ID is required'),
  initial_kg: z.coerce.number().gt(0, 'Initial stock quantity (KG) must be greater than 0'),
  avg_buy_price_per_kg: z.coerce.number().min(0, 'Average buy price per KG must be non-negative'),
  notes: z.string().nullable().optional(),
});

export const bulkInventoryOnboardingSchema = z.object({
  items: z.array(inventoryOnboardingItemSchema).min(1, 'At least one inventory record is required'),
});

export type CustomerOnboardingItem = z.infer<typeof customerOnboardingItemSchema>;
export type SupplierOnboardingItem = z.infer<typeof supplierOnboardingItemSchema>;
export type InventoryOnboardingItem = z.infer<typeof inventoryOnboardingItemSchema>;
