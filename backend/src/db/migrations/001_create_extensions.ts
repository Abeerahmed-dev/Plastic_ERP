import type { Knex } from 'knex';

/**
 * Migration 001 — PostgreSQL extensions
 *
 * Enables uuid-ossp for UUID primary key generation and pgcrypto
 * for cryptographic functions. Both are used across all modules.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
}

export async function down(_knex: Knex): Promise<void> {
  // Extensions are intentionally NOT dropped in rollback — other
  // system objects may depend on them and dropping would be destructive.
}
