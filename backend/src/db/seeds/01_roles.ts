import type { Knex } from 'knex';

export const ROLES = {
  OWNER: 'Owner',
  ACCOUNTANT: 'Accountant',
  CASHIER: 'Cashier',
  WAREHOUSE: 'Warehouse',
} as const;

const roles = [
  { name: ROLES.OWNER, description: 'Full access to all modules' },
  { name: ROLES.ACCOUNTANT, description: 'Sales, purchases, payments, ledgers, reports' },
  { name: ROLES.CASHIER, description: 'Walk-in POS sales and daily cash management' },
  { name: ROLES.WAREHOUSE, description: 'Products, inventory, and stock adjustments' },
];

export async function seed(knex: Knex): Promise<void> {
  // Idempotent — skip if already seeded
  const existing = await knex('roles').select('name');
  const existingNames = new Set(existing.map((r: { name: string }) => r.name));

  const toInsert = roles.filter((r) => !existingNames.has(r.name));
  if (toInsert.length > 0) {
    await knex('roles').insert(toInsert);
  }
}
