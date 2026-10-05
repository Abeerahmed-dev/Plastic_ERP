import api from './api';
import { BankAccount, CreateBankAccountInput, UpdateBankAccountInput } from '../types/bank-account.types';

export interface BankTransactionItem {
  id: string;
  date: string;
  description: string;
  type: 'INFLOW' | 'OUTFLOW';
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

  getBankAccount: async (id: string): Promise<BankAccount> => {
    const response = await api.get(`/bank-accounts/${id}`);
    return response.data.data;
  },

  getBankAccountTransactions: async (accountId: string): Promise<BankAccountTransactionsData> => {
    const response = await api.get(`/banks/${accountId}/transactions`);
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
};
