import db from '../../db/knex';

export interface CashierFeatureAccess {
  customer_access: boolean;
  party_access: boolean;
}

const SETTING_KEY = 'cashier_feature_access';

export async function getCashierFeatureAccess(): Promise<CashierFeatureAccess> {
  const row = await db('system_settings').where({ key: SETTING_KEY }).first();
  if (!row) {
    return { customer_access: false, party_access: false };
  }
  const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  return {
    customer_access: Boolean(val?.customer_access),
    party_access: Boolean(val?.party_access),
  };
}

export async function updateCashierFeatureAccess(
  data: Partial<CashierFeatureAccess>
): Promise<CashierFeatureAccess> {
  const current = await getCashierFeatureAccess();
  const updated: CashierFeatureAccess = {
    customer_access: data.customer_access !== undefined ? Boolean(data.customer_access) : current.customer_access,
    party_access: data.party_access !== undefined ? Boolean(data.party_access) : current.party_access,
  };

  const exists = await db('system_settings').where({ key: SETTING_KEY }).first();
  if (exists) {
    await db('system_settings')
      .where({ key: SETTING_KEY })
      .update({
        value: JSON.stringify(updated),
        updated_at: new Date(),
      });
  } else {
    await db('system_settings').insert({
      key: SETTING_KEY,
      value: JSON.stringify(updated),
      updated_at: new Date(),
    });
  }

  return updated;
}

