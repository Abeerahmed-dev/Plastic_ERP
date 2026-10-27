import {
  createEmployeeRecord,
  findEmployees,
  findEmployeeById,
  updateEmployeeRecord,
  deleteEmployeeRecord,
  getEmployeeLedger,
  addEmployeeLedgerEntry,
  deleteEmployeeLedgerEntry,
} from './employees.repository';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeQuery,
  CreateEmployeeLedgerEntryInput,
} from './employees.schemas';

export const employeesService = {
  create: async (data: CreateEmployeeInput, userId?: string) => {
    return createEmployeeRecord(data, userId);
  },

  getAll: async (query: EmployeeQuery = {}) => {
    return findEmployees(query);
  },

  getById: async (id: string) => {
    const employee = await findEmployeeById(id);
    if (!employee) throw new Error('Employee not found');
    return employee;
  },

  update: async (id: string, data: UpdateEmployeeInput) => {
    const existing = await findEmployeeById(id);
    if (!existing) throw new Error('Employee not found');
    return updateEmployeeRecord(id, data);
  },

  delete: async (id: string) => {
    const existing = await findEmployeeById(id);
    if (!existing) throw new Error('Employee not found');
    return deleteEmployeeRecord(id);
  },

  getLedger: async (employeeId: string, month?: string) => {
    return getEmployeeLedger(employeeId, month);
  },

  addLedgerEntry: async (
    employeeId: string,
    data: CreateEmployeeLedgerEntryInput,
    userId?: string
  ) => {
    return addEmployeeLedgerEntry(employeeId, data, userId);
  },

  deleteLedgerEntry: async (entryId: string) => {
    return deleteEmployeeLedgerEntry(entryId);
  },
};

