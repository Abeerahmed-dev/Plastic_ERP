import { z } from 'zod';

export const CreateEmployeeSchema = z.object({
  employee_id: z.string().trim().optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z.string().trim().optional().nullable(),
  designation: z.string().trim().min(1, 'Designation is required'),
  store_timing: z.string().trim().optional().nullable(),
  salary: z.coerce.number().min(0, 'Salary cannot be negative').default(0),
  cnic: z.string().trim().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).default('ACTIVE'),
  joining_date: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial();

export const EmployeeQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).optional(),
  designation: z.string().optional(),
});

export const CreateEmployeeLedgerEntrySchema = z.object({
  transaction_type: z.enum(['SALARY', 'ADVANCE', 'PAYMENT', 'BONUS', 'DEDUCTION']),
  date: z.string().optional(),
  reference_month: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM').optional(),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
  bank_account_id: z.string().uuid().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
export type EmployeeQuery = z.infer<typeof EmployeeQuerySchema>;
export type CreateEmployeeLedgerEntryInput = z.infer<typeof CreateEmployeeLedgerEntrySchema>;
