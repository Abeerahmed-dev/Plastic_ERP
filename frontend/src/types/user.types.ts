export type PayFrequency = 'WEEKLY' | 'MONTHLY' | 'CONTRACT';

export interface User {
  id: string;
  name: string;
  email: string | null;
  role_id: string | null;
  role_name: string | null;
  is_active: boolean;
  job_title: string | null;
  joining_date: string | null;
  pay_frequency: PayFrequency;
  base_salary: number;
  salary_amount?: number;
  last_paid_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  name: string;
  grant_access?: boolean;
  email?: string | null;
  password?: string | null;
  role_id?: string | null;
  job_title?: string | null;
  joining_date?: string | null;
  pay_frequency?: PayFrequency;
  base_salary?: number;
  salary_amount?: number;
  last_paid_date?: string | null;
  is_active?: boolean;
}

export interface UpdateUserData {
  name?: string;
  grant_access?: boolean;
  email?: string | null;
  password?: string | null;
  role_id?: string | null;
  is_active?: boolean;
  job_title?: string | null;
  joining_date?: string | null;
  pay_frequency?: PayFrequency;
  base_salary?: number;
  salary_amount?: number;
  last_paid_date?: string | null;
}

export interface Role {
  id: string;
  name: string;
}
