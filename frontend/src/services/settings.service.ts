import api from './api';

export interface CashierFeatureAccess {
  customer_access: boolean;
  party_access: boolean;
}

export const settingsService = {
  async getCashierFeatureAccess(): Promise<CashierFeatureAccess> {
    const res = await api.get('/settings/feature-access');
    return res.data.data;
  },

  async updateCashierFeatureAccess(payload: Partial<CashierFeatureAccess>): Promise<CashierFeatureAccess> {
    const res = await api.put('/settings/feature-access', payload);
    return res.data.data;
  },
};

