import * as repo from './onboarding.repository';
import { CustomerOnboardingItem, SupplierOnboardingItem, InventoryOnboardingItem } from './onboarding.schemas';

export const onboardingService = {
  bulkInsertCustomers: async (items: CustomerOnboardingItem[], createdBy: string) => {
    return repo.bulkInsertCustomers(items, createdBy);
  },

  bulkInsertSuppliers: async (items: SupplierOnboardingItem[], createdBy: string) => {
    return repo.bulkInsertSuppliers(items, createdBy);
  },

  bulkInitializeInventory: async (items: InventoryOnboardingItem[], createdBy: string) => {
    return repo.bulkInitializeInventory(items, createdBy);
  },
};
