export interface BankAccount {
  id: string;
  account_title: string;
  bank_name: string;
  account_number: string;
  iban_details?: string | null;
  initial_balance: number;
  current_balance: number;
  total_in?: number;
  total_out?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateBankAccountInput {
  account_title: string;
  bank_name: string;
  account_number: string;
  iban_details?: string;
  initial_balance?: number;
}

export interface UpdateBankAccountInput {
  account_title?: string;
  bank_name?: string;
  account_number?: string;
  iban_details?: string;
  initial_balance?: number;
  is_active?: boolean;
}
