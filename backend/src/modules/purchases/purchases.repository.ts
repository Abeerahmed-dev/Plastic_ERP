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
    .leftJoin('users as u', 'purchase_invoices.created_by', 'u.id')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
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

  const rawRows = await baseQuery
    .clone()
    .select(
      'purchase_invoices.*',
      'suppliers.name as supplier_name',
      'suppliers.code as supplier_code',
      'suppliers.city as city',
      'suppliers.city as supplier_city',
      'u.name as created_by_name',
      'r.name as created_by_role'
    )
    .orderBy('purchase_invoices.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const rows = rawRows.map((r: any) => ({
    ...r,
    created_by_name: r.created_by_name || 'System',
    created_by_role: r.created_by_role || 'ADMIN',
    creator: {
      name: r.created_by_name || 'System',
      role: r.created_by_role || 'ADMIN',
    },
  }));

  return { rows, total };
}

export async function findPurchaseInvoiceById(id: string) {
  const invoice = await db('purchase_invoices as pi')
    .join('suppliers as s', 'pi.supplier_id', 's.id')
    .leftJoin('users as u', 'pi.created_by', 'u.id')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .where('pi.id', id)
    .select(
      'pi.*',
      's.name as supplier_name',
      's.code as supplier_code',
      's.phone as supplier_phone',
      's.city as supplier_city',
      'u.name as created_by_name',
      'r.name as created_by_role'
    )
    .first();

  if (!invoice) return null;

  invoice.creator = {
    name: invoice.created_by_name || 'System',
    role: invoice.created_by_role || 'ADMIN',
  };

  const items = await db('purchase_invoice_items as pii')
    .join('products as p', 'pii.product_id', 'p.id')
    .leftJoin('categories as c', 'p.category_id', 'c.id')
    .where('pii.purchase_invoice_id', id)
    .select(
      'pii.*',
      'p.name as product_name',
      'p.code as product_code',
      'c.name as category_name',
      'c.bag_weight_kg as category_bag_weight_kg'
    );

  return { ...invoice, items };
}

/**
 * Weighted Average Costing (WAC) Purchase Execution
 */
export async function createPurchaseInvoice(data: any, createdBy: string) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const invoice_number = await generatePurchaseInvoiceNumber();

    let subtotal = 0;
    const itemsToInsert = [];

    for (const item of data.items) {
      // Direct KG Wholesale Model: quantity is strictly weight in KG, unit_price is rate per KG
      const quantity_kg = Number((item.quantity_kg ?? item.quantity) || 0);
      const price_per_kg = Number((item.price_per_kg ?? item.unit_price) || 0);
      const itemTotal = Math.round(quantity_kg * price_per_kg * 100) / 100;
      subtotal += itemTotal;

      // Fetch Product
      const productWithCat = await trx('products as p')
        .where('p.id', item.product_id)
        .select('p.id', 'p.total_stock_kg', 'p.rolling_avg_cost_per_kg')
        .first();

      if (!productWithCat) {
        throw new Error(`Product not found for product ID ${item.product_id}`);
      }

      const incoming_kg = quantity_kg;
      const purchase_cost_per_kg = price_per_kg;

      // ── Weighted Average Costing (WAC) Formula ──
      const currentStock = Number(productWithCat.total_stock_kg || 0);
      const currentAvgCost = Number(productWithCat.rolling_avg_cost_per_kg || 0);

      const currentTotalVal = currentStock * currentAvgCost;
      const incomingTotalVal = itemTotal;
      const newTotalStock = currentStock + incoming_kg;

      const newRollingAvg = newTotalStock > 0
        ? Math.round(((currentTotalVal + incomingTotalVal) / newTotalStock) * 10000) / 10000
        : purchase_cost_per_kg;

      // UPDATE products rolling stock and average cost
      await trx('products')
        .where('id', item.product_id)
        .update({
          total_stock_kg: newTotalStock,
          rolling_avg_cost_per_kg: newRollingAvg,
          cost_price: purchase_cost_per_kg,
          updated_at: new Date(),
        });

      // ── Price-Bucket Consolidation (FIFO Model) ──
      const roundedCostPerKg = Math.round(purchase_cost_per_kg * 100) / 100;
      
      const existingBucket = await trx('inventory_batches')
        .where('product_id', item.product_id)
        .andWhere('status', 'ACTIVE')
        .andWhereRaw('ABS(batch_buy_price_per_kg - ?) < 0.01', [roundedCostPerKg])
        .orderBy('created_at', 'desc')
        .first();

      if (existingBucket) {
        // MATCH: Merge incoming stock into existing price bucket
        const newOriginal = Number(existingBucket.original_qty || 0) + incoming_kg;
        const newRemaining = Number(existingBucket.remaining_qty || 0) + incoming_kg;

        await trx('inventory_batches')
          .where('id', existingBucket.id)
          .update({
            original_qty: newOriginal,
            remaining_qty: newRemaining,
            updated_at: new Date(),
          });
      } else {
        // NO MATCH: Insert new Price Bucket row
        const batchNum = `PB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await trx('inventory_batches').insert({
          product_id: item.product_id,
          batch_number: batchNum,
          batch_buy_price_per_kg: roundedCostPerKg,
          original_qty: incoming_kg,
          remaining_qty: incoming_kg,
          status: 'ACTIVE',
        });
      }

      itemsToInsert.push({
        product_id: item.product_id,
        quantity: quantity_kg,
        selected_unit: 'KG',
        actual_weight_per_unit: 1.0,
        net_kg_processed: incoming_kg,
        net_kg_added: incoming_kg,
        actual_weight_kg: incoming_kg,
        unit_price: price_per_kg,
        total_price: itemTotal,
      });
    }

    const discount = Number(data.discount) || 0;
    const total_amount = subtotal - discount;

    const advanceApplied = Number((data as any).advance_applied_amount || 0);
    const initialPaidAmount = advanceApplied;
    const invoiceStatus = initialPaidAmount >= total_amount ? 'PAID' : (initialPaidAmount > 0 ? 'PARTIAL' : 'UNPAID');

    const [invoice] = await trx('purchase_invoices')
      .insert({
        supplier_id: data.supplier_id,
        invoice_number,
        date: data.date,
        due_date: data.due_date || null,
        subtotal,
        discount,
        total_amount,
        paid_amount: initialPaidAmount,
        status: invoiceStatus,
        notes: data.notes || null,
        created_by: createdBy,
      })
      .returning('*');

    const itemsWithInvoiceId = itemsToInsert.map(item => ({
      ...item,
      purchase_invoice_id: invoice.id,
    }));

    const insertedItems = await trx('purchase_invoice_items').insert(itemsWithInvoiceId).returning('*');

    // Record inventory transactions for audit log
    for (let i = 0; i < insertedItems.length; i++) {
      const pii = insertedItems[i];
      const product = await trx('products').where('id', pii.product_id).select('rolling_avg_cost_per_kg').first();
      const avgCost = Number(product?.rolling_avg_cost_per_kg || 0);

      await trx('inventory_transactions').insert({
        product_id: pii.product_id,
        transaction_type: 'PURCHASE',
        quantity_kg: pii.net_kg_processed,
        unit_cost: avgCost,
        total_asset_value: Number(pii.total_price),
        capital_equity_value: 0,
        notes: `Purchase Invoice ${invoice.invoice_number} (${pii.quantity} KG @ ${pii.unit_price}/KG)`,
        created_by: createdBy,
      });
    }

    // Record Virtual Supplier Payment from Advance Wallet if advanceApplied > 0
    if (advanceApplied > 0) {
      const rows = await trx('supplier_payments')
        .where('payment_number', 'like', 'PAY-OUT-%')
        .select('payment_number');

      let maxNum = 0;
      for (const r of rows) {
        if (r.payment_number) {
          const numPart = r.payment_number.replace('PAY-OUT-', '');
          const num = parseInt(numPart, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
      const paymentNumber = `PAY-OUT-${(maxNum + 1).toString().padStart(5, '0')}`;

      const [virtualPayment] = await trx('supplier_payments').insert({
        supplier_id: data.supplier_id,
        purchase_invoice_id: invoice.id,
        payment_number: paymentNumber,
        payment_date: data.date || new Date().toISOString().split('T')[0],
        amount: advanceApplied,
        payment_method: 'WALLET_ADVANCE',
        cheque_status: 'CLEARED',
        notes: 'Manually applied from advance balance',
        created_by: createdBy,
      }).returning('*');

      await trx('supplier_payment_allocations').insert({
        payment_id: virtualPayment.id,
        purchase_invoice_id: invoice.id,
        allocated_amount: advanceApplied,
      });
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
