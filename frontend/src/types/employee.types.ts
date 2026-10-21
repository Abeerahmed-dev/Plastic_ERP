export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

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
