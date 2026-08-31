export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  credit_limit: number;
  opening_balance: number;
  outstanding_balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: 'Sindh' | 'Punjab' | 'KPK' | 'Balochistan' | 'Other';
  credit_limit?: number;
  opening_balance?: number;
  notes?: string;
}

export type UpdateCustomerData = Partial<Omit<CreateCustomerData, 'opening_balance'>> & {
  is_active?: boolean;
};

export interface CustomerFilters {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  region?: string;
  is_active?: boolean;
}
