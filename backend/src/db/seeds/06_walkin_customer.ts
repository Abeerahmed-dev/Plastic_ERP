import type { Knex } from 'knex';

export const WALKIN_CUSTOMER_PHONE = '00000000000';
export const WALKIN_CUSTOMER_NAME = 'Walk-in Customer';

export async function seed(knex: Knex): Promise<void> {
  // Check if walk-in customer already exists
  const existing = await knex('customers').where({ phone: WALKIN_CUSTOMER_PHONE }).first();
  
  if (!existing) {
    await knex('customers').insert({
      code: 'WALK-IN',
      name: WALKIN_CUSTOMER_NAME,
      phone: WALKIN_CUSTOMER_PHONE,
      address: 'POS Default Customer',
      opening_balance: 0,
    });
  }
}
