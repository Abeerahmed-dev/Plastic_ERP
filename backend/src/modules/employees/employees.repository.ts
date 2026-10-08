import db from '../../db/knex';
import { CreateEmployeeInput, UpdateEmployeeInput, EmployeeQuery } from './employees.schemas';

export async function getNextEmployeeId(): Promise<string> {
  const result = await db('employees').count('id as count').first();
  const count = Number(result?.count || 0) + 1;
  const candidate = `EMP-${String(count).padStart(3, '0')}`;
  
  // Verify candidate uniqueness
  const exists = await db('employees').where('employee_id', candidate).first();
  if (!exists) return candidate;
  return `EMP-${Date.now().toString().slice(-4)}`;
}

export async function createEmployeeRecord(data: CreateEmployeeInput) {
  const employeeId = data.employee_id?.trim() || (await getNextEmployeeId());

  const [created] = await db('employees')
    .insert({
      employee_id: employeeId,
      name: data.name,
      phone: data.phone || null,
      designation: data.designation,
      store_timing: data.store_timing || null,
      salary: data.salary ?? 0,
      cnic: data.cnic || null,
      status: data.status || 'ACTIVE',
      joining_date: data.joining_date || null,
      notes: data.notes || null,
    })
    .returning('*');

  return created;
}

export async function findEmployees(query: EmployeeQuery = {}) {
  let builder = db('employees').select('*').orderBy('created_at', 'desc');

  if (query.status) {
    builder = builder.where('status', query.status);
  }

  if (query.designation) {
    builder = builder.whereILike('designation', `%${query.designation}%`);
  }

  if (query.search) {
    const s = `%${query.search.trim()}%`;
    builder = builder.where(function () {
      this.whereILike('name', s)
        .orWhereILike('employee_id', s)
        .orWhereILike('phone', s)
        .orWhereILike('designation', s);
    });
  }

  return builder;
}

export async function findEmployeeById(id: string) {
  return db('employees').where('id', id).first();
}

export async function updateEmployeeRecord(id: string, data: UpdateEmployeeInput) {
  const updatePayload: Record<string, any> = {
    updated_at: new Date(),
  };

  if (data.employee_id !== undefined) updatePayload.employee_id = data.employee_id;
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.phone !== undefined) updatePayload.phone = data.phone;
  if (data.designation !== undefined) updatePayload.designation = data.designation;
  if (data.store_timing !== undefined) updatePayload.store_timing = data.store_timing;
  if (data.salary !== undefined) updatePayload.salary = data.salary;
  if (data.cnic !== undefined) updatePayload.cnic = data.cnic;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.joining_date !== undefined) updatePayload.joining_date = data.joining_date;
  if (data.notes !== undefined) updatePayload.notes = data.notes;

  const [updated] = await db('employees')
    .where('id', id)
    .update(updatePayload)
    .returning('*');

  return updated;
}

export async function deleteEmployeeRecord(id: string) {
  return db('employees').where('id', id).del();
}
