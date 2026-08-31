import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * Creates the default Owner account.
 *
 * ⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN.
 *
 * Email    : owner@sabir.local
 * Password : Admin@1234
 */
export async function seed(knex: Knex): Promise<void> {
  const OWNER_EMAIL = 'owner@sabir.local';

  // Idempotent — skip if the user already exists
  const existing = await knex('users').where({ email: OWNER_EMAIL }).first();
  if (existing) return;

  const ownerRole = await knex('roles').where({ name: 'Owner' }).first();
  if (!ownerRole) throw new Error('Owner role not found — run seed 01_roles first');

  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  await knex('users').insert({
    name: 'Owner',
    email: OWNER_EMAIL,
    password_hash: passwordHash,
    role_id: ownerRole.id,
    is_active: true,
  });
}
