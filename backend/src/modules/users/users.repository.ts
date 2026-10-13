import db from '../../db/knex';

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  role_id: string | null;
  role_name: string | null;
  is_active: boolean;
  job_title: string | null;
  joining_date: string | null;
  pay_frequency: 'WEEKLY' | 'MONTHLY' | 'CONTRACT';
  base_salary: number;
  salary_amount: number;
  last_paid_date: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function findAllUsers(): Promise<UserRow[]> {
  const rows = await db('users as u')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .select(
      'u.id',
      'u.name',
      'u.email',
      'u.role_id',
      'r.name as role_name',
      'u.is_active',
      'u.job_title',
      'u.joining_date',
      'u.pay_frequency',
      'u.base_salary',
      'u.last_paid_date',
      'u.created_at',
      'u.updated_at'
    )
    .orderBy('u.created_at', 'desc');

  return rows.map((r: any) => ({
    ...r,
    base_salary: parseFloat(r.base_salary || 0),
    salary_amount: parseFloat(r.base_salary || 0),
    role_name: r.role_name || null,
  }));
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const r = await db('users as u')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .where('u.id', id)
    .select(
      'u.id',
      'u.name',
      'u.email',
      'u.role_id',
      'r.name as role_name',
      'u.is_active',
      'u.job_title',
      'u.joining_date',
      'u.pay_frequency',
      'u.base_salary',
      'u.last_paid_date',
      'u.created_at',
      'u.updated_at'
    )
    .first();

  if (!r) return undefined;

  return {
    ...r,
    base_salary: parseFloat(r.base_salary || 0),
    salary_amount: parseFloat(r.base_salary || 0),
    role_name: r.role_name || null,
  };
}

export async function checkEmailExists(email: string, excludeId?: string): Promise<boolean> {
  let query = db('users').where('email', email.toLowerCase().trim());
  if (excludeId) {
    query = query.whereNot('id', excludeId);
  }
  const row = await query.first('id');
  return !!row;
}

export async function createUser(data: {
  name: string;
  email?: string | null;
  password_hash?: string | null;
  role_id?: string | null;
  is_active?: boolean;
  job_title?: string | null;
  joining_date?: string | Date | null;
  pay_frequency?: string;
  base_salary?: number;
  last_paid_date?: string | Date | null;
}): Promise<string> {
  const [row] = await db('users')
    .insert({
      name: data.name,
      email: data.email || null,
      password_hash: data.password_hash || null,
      role_id: data.role_id || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
      job_title: data.job_title || null,
      joining_date: data.joining_date || db.raw('CURRENT_DATE'),
      pay_frequency: data.pay_frequency || 'MONTHLY',
      base_salary: data.base_salary ?? 0,
      last_paid_date: data.last_paid_date || null,
    })
    .returning('id');
  return row.id;
}

export async function updateUser(id: string, data: Record<string, any>): Promise<void> {
  await db('users')
    .where({ id })
    .update({
      ...data,
      updated_at: db.fn.now(),
    });
}

export async function deleteUser(id: string): Promise<void> {
  await db('users').where({ id }).delete();
}

export async function findAllRoles(): Promise<{ id: string; name: string }[]> {
  return db('roles').select('id', 'name').orderBy('name', 'asc');
}
