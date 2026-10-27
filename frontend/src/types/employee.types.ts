export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type EmployeeTransactionType = 'SALARY' | 'ADVANCE' | 'PAYMENT' | 'BONUS' | 'DEDUCTION';

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  phone?: string | null;
  designation: string;
  store_timing?: string | null;
  salary: number;
  cnic?: string | null;
  status: EmployeeStatus;
  joining_date?: string | null;
  notes?: string | null;
  current_month?: string;
  current_month_salary?: number;
  current_month_advances?: number;
  current_month_remaining?: number;
  all_time_balance?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeData {
  employee_id?: string;
  name: string;
  phone?: string | null;
  designation: string;
  store_timing?: string | null;
  salary: number;
  cnic?: string | null;
  status?: EmployeeStatus;
  joining_date?: string | null;
  notes?: string | null;
}

export type UpdateEmployeeData = Partial<CreateEmployeeData>;

export interface EmployeeFilters {
  search?: string;
  status?: EmployeeStatus;
  designation?: string;
}

export interface EmployeeLedgerEntry {
  id: string;
  employee_id: string;
  transaction_type: EmployeeTransactionType;
  date: string;
  reference_month: string;
  description?: string | null;
  amount: number;
  debit: number;
  credit: number;
  running_balance: number;
  payment_method: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  bank_account_id?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface EmployeeLedgerData {
  employee: Employee;
  current_month: string;
  monthly_salary: number;
  total_salary_accrued_this_month: number;
  total_advances_this_month: number;
  remaining_salary_this_month: number;
  all_time_balance: number;
  transactions: EmployeeLedgerEntry[];
}

export interface CreateEmployeeLedgerEntryPayload {
  transaction_type: EmployeeTransactionType;
  date?: string;
  reference_month?: string;
  amount: number;
  payment_method?: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  bank_account_id?: string | null;
  description?: string | null;
}
