import api from './api';

export interface Expense {
  id: string;
  amount: number;
  paid_amount?: number;
  remaining_amount?: number;
  category: string;
  description?: string;
  expense_date: string;
  payment_method: string;
  status?: 'PENDING' | 'PARTIAL' | 'PAID' | 'UNPAID' | string;
  bank_account_id?: string | null;
  bank_name?: string;
  account_title?: string;
  purchase_id?: string | null;
  purchase_invoice_number?: string | null;
  supplier_name?: string | null;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

export interface OutstandingExpense {
  id: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  category: string;
  description?: string;
  expense_date?: string;
  status: string;
  purchase_id?: string | null;
  purchase_invoice_number?: string | null;
  supplier_name?: string | null;
}

export interface CreateExpenseData {
  amount: number;
  category: string;
  description?: string;
  expense_date?: string;
  payment_method?: string;
  bank_account_id?: string | null;
  status?: 'PENDING' | 'PAID' | 'UNPAID';
  purchase_id?: string | null;
}

export interface PayExpenseData {
  amount: number;
  payment_method: string;
  bank_account_id?: string | null;
  payment_date?: string;
  notes?: string | null;
}

export interface ExpenseFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  status?: string;
  payment_method?: string;
  bank_account_id?: string;
}

export const expensesService = {
  getExpenses: async (filters: ExpenseFilters = {}): Promise<Expense[]> => {
    const response = await api.get<{ data: Expense[] }>('/expenses', { params: filters });
    return response.data.data;
  },

  getOutstandingExpenses: async (category?: string): Promise<OutstandingExpense[]> => {
    const response = await api.get<{ data: OutstandingExpense[] }>('/expenses/outstanding', {
      params: category ? { category } : undefined,
    });
    return response.data.data;
  },

  createExpense: async (data: CreateExpenseData): Promise<Expense> => {
    const response = await api.post<{ data: Expense }>('/expenses', data);
    return response.data.data;
  },

  payExpense: async (id: string, data: PayExpenseData): Promise<Expense> => {
    const response = await api.post<{ data: Expense }>(`/expenses/${id}/pay`, data);
    return response.data.data;
  },

  deleteExpense: async (id: string): Promise<void> => {
    await api.delete(`/expenses/${id}`);
  },
};
