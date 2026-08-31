import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * Creates a development Cashier account for testing.
 *
 * Email    : cashier@sabirplastic.local
 * Password : Cashier@123
 */
export async function seed(knex: Knex): Promise<void> {
  const CASHIER_EMAIL = 'cashier@sabirplastic.local';

  // Idempotent — skip if the user already exists
  const existing = await knex('users').where({ email: CASHIER_EMAIL }).first();
  if (existing) return;

  const cashierRole = await knex('roles').where({ name: 'Cashier' }).first();
  if (!cashierRole) throw new Error('Cashier role not found — run seed 01_roles first');

  const passwordHash = await bcrypt.hash('Cashier@123', 12);

  await knex('users').insert({
    name: 'Cashier User',
    email: CASHIER_EMAIL,
    password_hash: passwordHash,
    role_id: cashierRole.id,
    is_active: true,
  });
}
