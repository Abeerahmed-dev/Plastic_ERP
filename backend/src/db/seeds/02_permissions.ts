import type { Knex } from 'knex';

/**
 * All module:action permission combinations.
 * Add new modules here as sessions progress.
 */
const MODULES = [
  'customers',
  'suppliers',
  'products',
  'inventory',
  'sales',
  'purchases',
  'payments',
  'reports',
  'settings',
  'users',
  'audit_logs',
] as const;

const ACTIONS = ['read', 'write', 'delete'] as const;

export async function seed(knex: Knex): Promise<void> {
  const permissions: { name: string; module: string; action: string }[] = [];

  for (const module of MODULES) {
    for (const action of ACTIONS) {
      permissions.push({ name: `${module}:${action}`, module, action });
    }
  }

  // Idempotent — insert only missing permissions
  const existing = await knex('permissions').select('name');
  const existingNames = new Set(existing.map((p: { name: string }) => p.name));

  const toInsert = permissions.filter((p) => !existingNames.has(p.name));
  if (toInsert.length > 0) {
    await knex('permissions').insert(toInsert);
  }
}
