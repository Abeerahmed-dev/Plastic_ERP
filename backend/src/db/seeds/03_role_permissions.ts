import type { Knex } from 'knex';

/**
 * Role → permission assignments.
 *
 * Owner       — ALL permissions
 * Accountant  — sales/purchases/payments/reports/customers/suppliers (read+write)
 * Cashier     — sales:read+write, products:read, inventory:read, payments:write
 * Warehouse   — products/inventory (read+write), stock adjustments via inventory:write
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  Owner: [
    'customers:read', 'customers:write', 'customers:delete',
    'suppliers:read', 'suppliers:write', 'suppliers:delete',
    'products:read', 'products:write', 'products:delete',
    'inventory:read', 'inventory:write', 'inventory:delete',
    'sales:read', 'sales:write', 'sales:delete',
    'purchases:read', 'purchases:write', 'purchases:delete',
    'payments:read', 'payments:write', 'payments:delete',
    'reports:read', 'reports:write', 'reports:delete',
    'settings:read', 'settings:write', 'settings:delete',
    'users:read', 'users:write', 'users:delete',
    'audit_logs:read', 'audit_logs:write', 'audit_logs:delete',
  ],
  Accountant: [
    'customers:read', 'customers:write',
    'suppliers:read', 'suppliers:write',
    'products:read',
    'inventory:read',
    'sales:read', 'sales:write',
    'purchases:read', 'purchases:write',
    'payments:read', 'payments:write',
    'reports:read',
    'audit_logs:read',
  ],
  Cashier: [
    'customers:read',
    'products:read',
    'inventory:read',
    'sales:read', 'sales:write',
    'payments:write',
  ],
  Warehouse: [
    'products:read', 'products:write',
    'inventory:read', 'inventory:write',
    'suppliers:read',
    'reports:read',
  ],
};

export async function seed(knex: Knex): Promise<void> {
  const roles = await knex('roles').select('id', 'name');
  const permissions = await knex('permissions').select('id', 'name');

  const roleMap = new Map(roles.map((r: { id: string; name: string }) => [r.name, r.id]));
  const permMap = new Map(permissions.map((p: { id: string; name: string }) => [p.name, p.id]));

  const existing = await knex('role_permissions').select('role_id', 'permission_id');
  const existingSet = new Set(
    existing.map((rp: { role_id: string; permission_id: string }) => `${rp.role_id}:${rp.permission_id}`),
  );

  const toInsert: { role_id: string; permission_id: string }[] = [];

  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) continue;

    for (const permName of permNames) {
      const permId = permMap.get(permName);
      if (!permId) continue;
      const key = `${roleId}:${permId}`;
      if (!existingSet.has(key)) {
        toInsert.push({ role_id: roleId, permission_id: permId });
      }
    }
  }

  if (toInsert.length > 0) {
    await knex('role_permissions').insert(toInsert);
  }
}
