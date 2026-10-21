import api from './api';
import { BankAccount, CreateBankAccountInput, UpdateBankAccountInput } from '../types/bank-account.types';

export interface BankTransactionItem {
  id: string;
  date: string;
  description: string;
  type: 'INFLOW' | 'OUTFLOW';
  transaction_type?: 'DEPOSIT' | 'WITHDRAWAL';
  source?: 'POS' | 'CUSTOMER_PAYMENT' | 'OUTFLOW';
  source_type?: 'POS' | 'CUSTOMER_PAYMENT' | 'OUTFLOW';
  amount: number;
  running_balance: number;
}

export interface BankAccountTransactionsData {
  account: BankAccount;
  transactions: BankTransactionItem[];
}

export const bankAccountsService = {
  getBankAccounts: async (): Promise<BankAccount[]> => {
    const response = await api.get('/bank-accounts');
    return response.data.data || [];
  },

  getCashDrawerBalance: async (): Promise<{ balance: number }> => {
    const response = await api.get('/bank-accounts/cash-drawer-balance');
    return response.data.data;
  },

  getBankAccount: async (id: string): Promise<BankAccount> => {
    const response = await api.get(`/bank-accounts/${id}`);
    return response.data.data;
  },

  getBankAccountTransactions: async (
    accountId: string,
    params?: { source?: string; transaction_type?: string }
  ): Promise<BankAccountTransactionsData> => {
    const response = await api.get(`/bank-accounts/${accountId}/transactions`, { params });
    return response.data.data;
  },


  createBankAccount: async (data: CreateBankAccountInput): Promise<BankAccount> => {
    const response = await api.post('/bank-accounts', data);
    return response.data.data;
  },

  updateBankAccount: async (id: string, data: UpdateBankAccountInput): Promise<BankAccount> => {
    const response = await api.put(`/bank-accounts/${id}`, data);
    return response.data.data;
  },

  deleteBankAccount: async (id: string): Promise<void> => {
    await api.delete(`/bank-accounts/${id}`);
  },

  transferFunds: async (data: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    notes?: string;
    date?: string;
  }): Promise<{ success: boolean; message: string; from_balance: number; to_balance: number }> => {
    const response = await api.post('/bank-accounts/transfer', data);
    return response.data.data;
  },
};

