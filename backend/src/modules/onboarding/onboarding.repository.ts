import db from '../../db/knex';
import { CustomerOnboardingItem, SupplierOnboardingItem, InventoryOnboardingItem } from './onboarding.schemas';

/**
 * Generate sequential customer code: CUST-0001, CUST-0002, ...
 */
async function getNextCustomerCode(trx: typeof db): Promise<string> {
  const result = await trx('customers').max('code as max_code').first<{ max_code: string | null }>();
  if (!result?.max_code) return 'CUST-0001';
  const parts = result.max_code.split('-');
  const num = parseInt(parts[1] ?? '0', 10);
  return `CUST-${String(num + 1).padStart(4, '0')}`;
}

/**
 * Generate sequential supplier code: SUPP-0001, SUPP-0002, ...
 */
async function getNextSupplierCode(trx: typeof db): Promise<string> {
  const result = await trx('suppliers').max('code as max_code').first<{ max_code: string | null }>();
  if (!result?.max_code) return 'SUPP-0001';
  const parts = result.max_code.split('-');
  const num = parseInt(parts[1] ?? '0', 10);
  return `SUPP-${String(num + 1).padStart(4, '0')}`;
}

export async function bulkInsertCustomers(
  items: CustomerOnboardingItem[],
  createdBy: string,
) {
  return db.transaction(async (trx) => {
    const created = [];
    for (const item of items) {
      const code = await getNextCustomerCode(trx);
      const [customer] = await trx('customers')
        .insert({
          code,
          name: item.name,
          phone: item.phone || null,
          email: item.email || null,
          address: item.address || null,
          city: item.city || null,
          region: item.region || null,
          opening_balance: item.opening_balance,
          credit_limit: 0,
          created_by: createdBy,
        })
        .returning('*');
      created.push(customer);
    }
    return created;
  });
}

export async function bulkInsertSuppliers(
  items: SupplierOnboardingItem[],
  createdBy: string,
) {
  return db.transaction(async (trx) => {
    const created = [];
    for (const item of items) {
      const code = await getNextSupplierCode(trx);
      const payableValue = Math.abs(item.opening_balance);
      const [supplier] = await trx('suppliers')
        .insert({
          code,
          name: item.name,
          phone: item.phone || null,
          email: item.email || null,
          address: item.address || null,
          city: item.city || null,
          region: item.region || null,
          opening_balance: item.opening_balance,
          opening_payable: payableValue,
          created_by: createdBy,
        })
        .returning('*');
      created.push(supplier);
    }
    return created;
  });
}

export async function bulkInitializeInventory(
  items: InventoryOnboardingItem[],
  createdBy: string,
) {
  return db.transaction(async (trx) => {
    const records = [];

    for (const item of items) {
      const totalAssetValue = Math.round(Number(item.initial_kg) * Number(item.avg_buy_price_per_kg) * 100) / 100;

      // 1. Record stock initialization transaction in inventory_transactions
      const [transaction] = await trx('inventory_transactions')
        .insert({
          product_id: item.product_id,
          transaction_type: 'OPENING_STOCK',
          quantity_kg: item.initial_kg,
          unit_cost: item.avg_buy_price_per_kg,
          total_asset_value: totalAssetValue,
          capital_equity_value: totalAssetValue,
          notes: item.notes || 'Day Zero Physical Stock Initialization',
          created_by: createdBy,
        })
        .returning('*');

      // 2. Fetch product's unit conversions
      const productRow = await trx('products').where({ id: item.product_id }).select('code', 'unit_conversions', 'purchase_unit', 'default_kg_per_purchase_unit').first();
      const conversions = productRow && productRow.unit_conversions
        ? (typeof productRow.unit_conversions === 'string' ? JSON.parse(productRow.unit_conversions) : productRow.unit_conversions)
        : { Bora: 25.0, Peti: 15.0, Dasti: 0.5, Pura: 5.0, KG: 1.0 };

      // 3. Create opening stock batch in inventory_batches
      await trx('inventory_batches').insert({
        product_id: item.product_id,
        batch_number: `BATCH-OPENING-${productRow?.code || item.product_id.substring(0,4)}`,
        initial_qty: item.initial_kg,
        remaining_qty: item.initial_kg,
        buy_price_per_kg: item.avg_buy_price_per_kg,
        selected_unit: productRow?.purchase_unit || 'Bora',
        actual_weight_per_unit: Number(productRow?.default_kg_per_purchase_unit || 25.0),
        batch_unit_conversions: JSON.stringify(conversions),
      });

      // 4. Update master product stock and cost price
      const [updatedProduct] = await trx('products')
        .where('id', item.product_id)
        .update({
          opening_stock: trx.raw('opening_stock + ?', [item.initial_kg]),
          cost_price: item.avg_buy_price_per_kg,
          updated_at: new Date(),
        })
        .returning('*');

      records.push({ transaction, product: updatedProduct });
    }

    return records;
  });
}
