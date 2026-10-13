export interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  payment_terms: number;
  opening_payable: number;
  outstanding_payable: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  payment_terms?: number;
  opening_payable?: number;
  opening_balance?: number;
  opening_advance?: number;
  notes?: string;
}

export type UpdateSupplierData = Partial<Omit<CreateSupplierData, 'opening_payable' | 'opening_balance' | 'opening_advance'>> & {
  is_active?: boolean;
};

export interface SupplierFilters {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  region?: string;
  is_active?: boolean;
}
