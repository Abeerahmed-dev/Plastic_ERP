import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const existing = await knex('suppliers').where({ name: 'Default Supplier' }).first();
  if (!existing) {
    await knex('suppliers').insert({
      code: 'SUPP-0001',
      name: 'Default Supplier',
      phone: '03000000001',
      city: 'Lahore',
      region: 'Punjab',
      payment_terms: 30,
      opening_payable: 0,
    });
  }
}
