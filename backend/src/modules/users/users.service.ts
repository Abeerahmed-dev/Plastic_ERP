import bcrypt from 'bcrypt';
import * as usersRepo from './users.repository';
import { CreateUserInput, UpdateUserInput } from './users.schemas';
import { ConflictError, NotFoundError } from '../../shared/errors';

export async function getUsers() {
  return usersRepo.findAllUsers();
}

export async function getUser(id: string) {
  const user = await usersRepo.findUserById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function createUser(input: CreateUserInput) {
  const email = input.email ? input.email.trim().toLowerCase() : null;
  if (email) {
    const exists = await usersRepo.checkEmailExists(email);
    if (exists) throw new ConflictError('Email already in use');
  }

  const password_hash = input.password ? await bcrypt.hash(input.password, 10) : null;
  const salary = input.base_salary !== undefined ? input.base_salary : (input.salary_amount ?? 0);

  const id = await usersRepo.createUser({
    name: input.name,
    email,
    password_hash,
    role_id: input.role_id || null,
    is_active: input.is_active !== undefined ? input.is_active : true,
    job_title: input.job_title?.trim() || null,
    joining_date: input.joining_date || new Date().toISOString().split('T')[0],
    pay_frequency: input.pay_frequency || 'MONTHLY',
    base_salary: salary,
    last_paid_date: input.last_paid_date || null,
  });

  return getUser(id);
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await usersRepo.findUserById(id);
  if (!user) throw new NotFoundError('User not found');

  const email = input.email !== undefined ? (input.email ? input.email.trim().toLowerCase() : null) : undefined;
  if (email) {
    const exists = await usersRepo.checkEmailExists(email, id);
    if (exists) throw new ConflictError('Email already in use');
  }

  const updatePayload: Record<string, any> = {};

  if (input.name !== undefined) updatePayload.name = input.name;
  if (email !== undefined) updatePayload.email = email;
  if (input.role_id !== undefined) updatePayload.role_id = input.role_id || null;
  if (input.is_active !== undefined) updatePayload.is_active = input.is_active;
  if (input.job_title !== undefined) updatePayload.job_title = input.job_title ? input.job_title.trim() : null;
  if (input.joining_date !== undefined) updatePayload.joining_date = input.joining_date || null;
  if (input.pay_frequency !== undefined) updatePayload.pay_frequency = input.pay_frequency;
  
  if (input.base_salary !== undefined) {
    updatePayload.base_salary = input.base_salary;
  } else if (input.salary_amount !== undefined) {
    updatePayload.base_salary = input.salary_amount;
  }

  if (input.last_paid_date !== undefined) updatePayload.last_paid_date = input.last_paid_date || null;

  if (input.password) {
    updatePayload.password_hash = await bcrypt.hash(input.password, 10);
  } else if (input.grant_access === false) {
    updatePayload.email = null;
    updatePayload.password_hash = null;
    updatePayload.role_id = null;
  }

  await usersRepo.updateUser(id, updatePayload);
  return getUser(id);
}

export async function deleteUser(id: string) {
  const user = await usersRepo.findUserById(id);
  if (!user) throw new NotFoundError('User not found');

  // Hard delete
  await usersRepo.deleteUser(id);
}

export async function getRoles() {
  return usersRepo.findAllRoles();
}
