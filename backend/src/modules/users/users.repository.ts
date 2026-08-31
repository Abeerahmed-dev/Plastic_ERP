import db from '../../db/knex';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function findAllUsers(): Promise<UserRow[]> {
  return db('users as u')
    .join('roles as r', 'u.role_id', 'r.id')
    .select(
      'u.id',
      'u.name',
      'u.email',
      'u.role_id',
      'r.name as role_name',
      'u.is_active',
      'u.created_at',
      'u.updated_at'
    )
    .orderBy('u.created_at', 'desc');
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  return db('users as u')
    .join('roles as r', 'u.role_id', 'r.id')
    .where('u.id', id)
    .select(
      'u.id',
      'u.name',
      'u.email',
      'u.role_id',
      'r.name as role_name',
      'u.is_active',
      'u.created_at',
      'u.updated_at'
    )
    .first();
}

export async function checkEmailExists(email: string, excludeId?: string): Promise<boolean> {
  let query = db('users').where('email', email);
  if (excludeId) {
    query = query.whereNot('id', excludeId);
  }
  const row = await query.first('id');
  return !!row;
}

export async function createUser(data: { name: string; email: string; password_hash: string; role_id: string }): Promise<string> {
  const [row] = await db('users').insert(data).returning('id');
  return row.id;
}

export async function updateUser(id: string, data: Partial<{ name: string; email: string; role_id: string; is_active: boolean }>): Promise<void> {
  await db('users').where({ id }).update({
    ...data,
    updated_at: db.fn.now()
  });
}

export async function deleteUser(id: string): Promise<void> {
  await db('users').where({ id }).delete();
}

export async function findAllRoles(): Promise<{ id: string; name: string }[]> {
  return db('roles').select('id', 'name').orderBy('name', 'asc');
}
