import api from './api';

export interface CustomerOnboardingInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  opening_balance: number;
}

export interface SupplierOnboardingInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  opening_balance: number;
}

export interface InventoryOnboardingInput {
  product_id: string;
  initial_kg: number;
  avg_buy_price_per_kg: number;
  notes?: string | null;
}

export const onboardingService = {
  bulkCustomers: async (customers: CustomerOnboardingInput[]) => {
    const res = await api.post('/onboarding/customers', { customers });
    return res.data;
  },

  bulkSuppliers: async (suppliers: SupplierOnboardingInput[]) => {
    const res = await api.post('/onboarding/suppliers', { suppliers });
    return res.data;
  },

  bulkInventory: async (items: InventoryOnboardingInput[]) => {
    const res = await api.post('/onboarding/inventory', { items });
    return res.data;
  },
};
