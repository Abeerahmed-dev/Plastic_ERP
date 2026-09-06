import db from '../../db/knex';
import { Knex } from 'knex';

export interface PurchaseInvoiceQuery {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  supplier_id?: string;
  startDate?: string;
  endDate?: string;
}

export async function generatePurchaseInvoiceNumber(): Promise<string> {
  const lastInvoice = await db('purchase_invoices')
    .orderBy('created_at', 'desc')
    .select('invoice_number')
    .first();

  if (!lastInvoice || !lastInvoice.invoice_number) {
    return 'PUR-0001';
  }

  const parts = lastInvoice.invoice_number.split('-');
  const num = parseInt(parts[1] ?? '0', 10);
  return `PUR-${String(num + 1).padStart(4, '0')}`;
}

export async function findAllPurchaseInvoices(query: PurchaseInvoiceQuery) {
  const { page, limit, search, status, supplier_id, startDate, endDate } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('purchase_invoices')
    .join('suppliers', 'purchase_invoices.supplier_id', 'suppliers.id')
    .modify((qb: Knex.QueryBuilder) => {
      if (search) {
        qb.where((inner: Knex.QueryBuilder) => {
          inner
            .whereILike('purchase_invoices.invoice_number', `%${search}%`)
            .orWhereILike('suppliers.name', `%${search}%`);
        });
      }
      if (status) qb.where('purchase_invoices.status', status);
      if (supplier_id) qb.where('purchase_invoices.supplier_id', supplier_id);
      if (startDate) qb.where('purchase_invoices.date', '>=', startDate);
      if (endDate) qb.where('purchase_invoices.date', '<=', endDate);
    });

  const [{ count }] = await baseQuery.clone().count('purchase_invoices.id as count');
  const total = parseInt(String(count), 10);

  const rows = await baseQuery
    .clone()
    .select(
      'purchase_invoices.*',
      'suppliers.name as supplier_name',
      'suppliers.code as supplier_code'
    )
    .orderBy('purchase_invoices.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return { rows, total };
}

export async function findPurchaseInvoiceById(id: string) {
  const invoice = await db('purchase_invoices as pi')
    .join('suppliers as s', 'pi.supplier_id', 's.id')
    .where('pi.id', id)
    .select(
      'pi.*',
      's.name as supplier_name',
      's.code as supplier_code',
      's.phone as supplier_phone',
      's.city as supplier_city'
    )
    .first();

  if (!invoice) return null;

  const items = await db('purchase_invoice_items as pii')
    .join('products as p', 'pii.product_id', 'p.id')
    .where('pii.purchase_invoice_id', id)
    .select(
      'pii.*',
      'p.name as product_name',
      'p.code as product_code'
    );

  return { ...invoice, items };
}

export async function createPurchaseInvoice(data: any, createdBy: string) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const invoice_number = await generatePurchaseInvoiceNumber();

    let subtotal = 0;
    const itemsToInsert = [];

    // Calculate item totals and net_kg_processed (Calculation Engine & Proportional Scaling)
    for (const item of data.items) {
      const itemTotal = Number(item.quantity) * Number(item.unit_price);
      subtotal += itemTotal;

      const selected_unit = item.selected_unit || 'Bora';

      const actual_weight_per_unit = item.actual_weight_per_unit !== undefined && item.actual_weight_per_unit !== null && item.actual_weight_per_unit !== ''
        ? Number(item.actual_weight_per_unit)
        : null;

      const product = await trx('products')
        .where({ id: item.product_id })
        .select('unit_conversions', 'default_kg_per_purchase_unit')
        .first();

      const conversions = (product && product.unit_conversions)
        ? (typeof product.unit_conversions === 'string' ? JSON.parse(product.unit_conversions) : product.unit_conversions)
        : {};

      let defaultRate = conversions[selected_unit] !== undefined ? Number(conversions[selected_unit]) : 0;
      if (!defaultRate || defaultRate <= 0) {
        if (product && product.default_kg_per_purchase_unit && Number(product.default_kg_per_purchase_unit) > 0) {
          defaultRate = Number(product.default_kg_per_purchase_unit);
          conversions[selected_unit] = defaultRate;
        } else {
          throw new Error(`Unit conversion metric for unit '${selected_unit}' is missing on product.`);
        }
      }

      const multiplier = (actual_weight_per_unit && !isNaN(actual_weight_per_unit) && actual_weight_per_unit > 0)
        ? actual_weight_per_unit
        : defaultRate;

      const net_kg_processed = Number(item.quantity) * multiplier;

      // ── Proportional Unit Matrix Scaling ──
      const variance_ratio = defaultRate > 0 ? multiplier / defaultRate : 1.0;
      const scaled_conversions: Record<string, number> = {};
      for (const [uKey, uWt] of Object.entries(conversions)) {
        scaled_conversions[uKey] = Math.round(Number(uWt) * variance_ratio * 10000) / 10000;
      }

      // Compatibility for legacy actual_weight_kg override if provided directly
      const legacyOverride = item.actual_weight_kg ?? item.actualWeightOverride;
      const finalNetKg = (legacyOverride && Number(legacyOverride) > 0) ? Number(legacyOverride) : net_kg_processed;

      itemsToInsert.push({
        product_id: item.product_id,
        quantity: item.quantity,
        selected_unit,
        actual_weight_per_unit: actual_weight_per_unit ?? null,
        net_kg_processed: finalNetKg,
        net_kg_added: finalNetKg,
        actual_weight_kg: legacyOverride ? Number(legacyOverride) : null,
        unit_price: item.unit_price,
        total_price: itemTotal,
        batch_unit_conversions: JSON.stringify(scaled_conversions),
      });
    }

    const discount = Number(data.discount) || 0;
    const total_amount = subtotal - discount;

    const [invoice] = await trx('purchase_invoices')
      .insert({
        supplier_id: data.supplier_id,
        invoice_number,
        date: data.date,
        due_date: data.due_date || null,
        subtotal,
        discount,
        total_amount,
        paid_amount: 0,
        status: 'UNPAID',
        notes: data.notes || null,
        created_by: createdBy,
      })
      .returning('*');

    // Attach invoice_id to items
    const itemsWithInvoiceId = itemsToInsert.map(item => ({
      ...item,
      purchase_invoice_id: invoice.id,
    }));

    const insertedItems = await trx('purchase_invoice_items').insert(itemsWithInvoiceId).returning('*');

    // Create Inventory Batches for each purchase item
    for (let i = 0; i < insertedItems.length; i++) {
      const pii = insertedItems[i];
      const origItem = itemsToInsert[i];

      const buy_price_per_kg = pii.net_kg_processed > 0
        ? Math.round((Number(pii.total_price) / Number(pii.net_kg_processed)) * 100) / 100
        : Number(pii.unit_price);

      await trx('inventory_batches').insert({
        product_id: pii.product_id,
        purchase_invoice_item_id: pii.id,
        batch_number: `BATCH-${invoice_number}-${i + 1}`,
        initial_qty: pii.net_kg_processed,
        remaining_qty: pii.net_kg_processed,
        buy_price_per_kg,
        selected_unit: pii.selected_unit,
        actual_weight_per_unit: pii.actual_weight_per_unit,
        batch_unit_conversions: origItem.batch_unit_conversions,
      });

      // Also record inventory transaction for audit tracking
      await trx('inventory_transactions').insert({
        product_id: pii.product_id,
        transaction_type: 'PURCHASE',
        quantity_kg: pii.net_kg_processed,
        unit_cost: buy_price_per_kg,
        total_asset_value: Number(pii.total_price),
        capital_equity_value: 0,
        notes: `Purchase Invoice ${invoice.invoice_number}`,
        created_by: createdBy,
      });
    }

    // Update product cost_price to the latest purchase price
    for (const item of itemsWithInvoiceId) {
      await trx('products')
        .where('id', item.product_id)
        .update({ cost_price: item.unit_price });
    }

    return invoice;
  });
}

export async function updatePurchaseInvoiceStatus(id: string, updateData: { status?: string; paid_amount?: number }) {
  const [updated] = await db('purchase_invoices')
    .where({ id })
    .update({ ...updateData, updated_at: new Date() })
    .returning('*');
  return updated;
}

