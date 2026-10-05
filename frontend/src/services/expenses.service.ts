import api from './api';

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description?: string;
  expense_date: string;
  payment_method: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

export interface CreateExpenseData {
  amount: number;
  category: string;
  description?: string;
  expense_date?: string;
  payment_method?: string;
}

export interface ExpenseFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  payment_method?: string;
}

export const expensesService = {
  getExpenses: async (filters: ExpenseFilters = {}): Promise<Expense[]> => {
    const response = await api.get<{ data: Expense[] }>('/expenses', { params: filters });
    return response.data.data;
  },

  createExpense: async (data: CreateExpenseData): Promise<Expense> => {
    const response = await api.post<{ data: Expense }>('/expenses', data);
    return response.data.data;
  },

  deleteExpense: async (id: string): Promise<void> => {
    await api.delete(`/expenses/${id}`);
  },
};
