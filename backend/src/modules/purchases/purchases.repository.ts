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
  created_by?: string;
  invoice_type?: string;
}

export async function generatePurchaseInvoiceNumber(): Promise<string> {
  const lastInvoice = await db('purchase_invoices')
    .where('invoice_number', 'like', 'PUR-%')
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

export async function generateNextDebitNoteNumber(trx: Knex.Transaction | Knex = db): Promise<string> {
  const last = await trx('purchase_invoices')
    .where('invoice_type', 'DEBIT_NOTE')
    .orWhere('invoice_number', 'like', 'DN-%')
    .orderBy('created_at', 'desc')
    .first();

  if (!last || !last.invoice_number || !last.invoice_number.startsWith('DN-')) {
    return 'DN-0001';
  }

  const parts = last.invoice_number.split('-');
  const num = parseInt(parts[1] ?? '0', 10);
  return `DN-${String(num + 1).padStart(4, '0')}`;
}

export async function findAllPurchaseInvoices(query: PurchaseInvoiceQuery) {
  const { page, limit, search, status, supplier_id, startDate, endDate, created_by, invoice_type } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('purchase_invoices')
    .join('suppliers', 'purchase_invoices.supplier_id', 'suppliers.id')
    .leftJoin('users as u', 'purchase_invoices.created_by', 'u.id')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .modify((qb: Knex.QueryBuilder) => {
      if (created_by) qb.where('purchase_invoices.created_by', created_by);
      if (invoice_type) {
        qb.where('purchase_invoices.invoice_type', invoice_type);
      } else {
        qb.where(function() {
          this.whereNull('purchase_invoices.invoice_type')
            .orWhereNotIn('purchase_invoices.invoice_type', ['DEBIT_NOTE', 'CREDIT_NOTE', 'RETURN']);
        }).whereNull('purchase_invoices.parent_invoice_id');
      }
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

  const invoiceIds = rawRows.map((r: any) => r.id);
  const paymentsByInvoice = new Map<string, any[]>();
  const debitNotesByInvoice = new Map<string, any[]>();
  const debitNotesTotalByInvoice = new Map<string, number>();

  if (invoiceIds.length > 0) {
    const hasAllocationsTable = await db.schema.hasTable('supplier_payment_allocations');
    const allocatedPayments = hasAllocationsTable
      ? await db('supplier_payment_allocations as spa')
          .join('supplier_payments as sp', 'spa.payment_id', 'sp.id')
          .whereIn('spa.purchase_invoice_id', invoiceIds)
          .select(
            'sp.id',
            'spa.purchase_invoice_id',
            'sp.payment_number',
            'sp.payment_date',
            'spa.allocated_amount as amount',
            'sp.payment_method',
            'sp.notes',
            'sp.cheque_number',
            'sp.created_at'
          )
          .orderBy('sp.payment_date', 'asc')
          .orderBy('sp.created_at', 'asc')
      : [];

    const directPayments = await db('supplier_payments')
      .whereIn('purchase_invoice_id', invoiceIds)
      .select(
        'id',
        'purchase_invoice_id',
        'payment_number',
        'payment_date',
        'amount',
        'payment_method',
        'notes',
        'cheque_number',
        'created_at'
      )
      .orderBy('payment_date', 'asc')
      .orderBy('created_at', 'asc');

    const seenKeys = new Set<string>();

    for (const p of allocatedPayments) {
      const key = `${p.purchase_invoice_id}_${p.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const list = paymentsByInvoice.get(p.purchase_invoice_id) || [];
        list.push({
          id: p.id,
          payment_date: p.payment_date,
          amount: Number(p.amount || 0),
          payment_method: p.payment_method,
          payment_number: p.payment_number,
          reference_number: p.payment_number || p.cheque_number || p.notes || '',
          reference_notes: p.notes || '',
          notes: p.notes || '',
          cheque_number: p.cheque_number || null,
        });
        paymentsByInvoice.set(p.purchase_invoice_id, list);
      }
    }

    for (const p of directPayments) {
      const key = `${p.purchase_invoice_id}_${p.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const list = paymentsByInvoice.get(p.purchase_invoice_id) || [];
        list.push({
          id: p.id,
          payment_date: p.payment_date,
          amount: Number(p.amount || 0),
          payment_method: p.payment_method,
          payment_number: p.payment_number,
          reference_number: p.payment_number || p.cheque_number || p.notes || '',
          reference_notes: p.notes || '',
          notes: p.notes || '',
          cheque_number: p.cheque_number || null,
        });
        paymentsByInvoice.set(p.purchase_invoice_id, list);
      }
    }

    // Eagerly load child returns (Debit Notes) linked to parent purchase invoices
    const linkedDebitNotes = await db('purchase_invoices as pi')
      .whereIn('pi.parent_invoice_id', invoiceIds)
      .where(function() {
        this.where('pi.invoice_type', 'DEBIT_NOTE')
          .orWhere('pi.invoice_type', 'RETURN')
          .orWhere('pi.invoice_number', 'like', 'DN-%');
      })
      .whereNotIn('pi.status', ['CANCELLED', 'VOID'])
      .select('pi.*')
      .orderBy('pi.created_at', 'asc');

    for (const dn of linkedDebitNotes) {
      const pid = dn.parent_invoice_id;
      if (!pid) continue;
      const list = debitNotesByInvoice.get(pid) || [];
      list.push(dn);
      debitNotesByInvoice.set(pid, list);
      const curSum = debitNotesTotalByInvoice.get(pid) || 0;
      debitNotesTotalByInvoice.set(pid, curSum + Math.abs(Number(dn.total_amount || 0)));
    }
  }

  const rows = rawRows.map((r: any) => {
    const hasReturnsFlag = Boolean(r.has_returns);
    const returned_total = debitNotesTotalByInvoice.get(r.id) || 0;
    const net_invoice_total = hasReturnsFlag
      ? Number(r.total_amount || 0)
      : Math.round((Number(r.total_amount || 0) - returned_total) * 100) / 100;
    const original_total = hasReturnsFlag
      ? Math.round((Number(r.total_amount || 0) + returned_total) * 100) / 100
      : Number(r.total_amount || 0);
    const amount_paid = Number(r.paid_amount || r.amount_paid || 0);
    // CRITICAL: True net balance without Math.max(0, ...). Allow negative numbers for OVERPAID state.
    const balance_due = (r.balance_due !== undefined && r.balance_due !== null)
      ? Number(r.balance_due)
      : Math.round((net_invoice_total - amount_paid) * 100) / 100;
    const payments = paymentsByInvoice.get(r.id) || [];
    const linked_debit_notes = debitNotesByInvoice.get(r.id) || [];

    const dynamicStatus = r.status === 'CANCELLED'
      ? 'CANCELLED'
      : (balance_due <= 0 ? 'PAID' : (amount_paid > 0 ? 'PARTIAL' : 'UNPAID'));

    return {
      ...r,
      has_returns: hasReturnsFlag || returned_total > 0,
      status: dynamicStatus,
      total_amount: net_invoice_total,
      original_total,
      linked_returns_total: returned_total,
      net_total: net_invoice_total,
      net_invoice_total: net_invoice_total,
      paid_amount: amount_paid,
      amount_paid: amount_paid,
      balance_due,
      payments,
      supplier_payments: payments,
      linked_debit_notes,
      created_by_name: r.created_by_name || 'System',
      created_by_role: r.created_by_role || 'ADMIN',
      creator: {
        name: r.created_by_name || 'System',
        role: r.created_by_role || 'ADMIN',
      },
    };
  });

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

  const debitNotesRows = await db('purchase_invoices as pi')
    .where('pi.parent_invoice_id', id)
    .where('pi.invoice_type', 'DEBIT_NOTE')
    .whereNotIn('pi.status', ['CANCELLED', 'VOID'])
    .select('pi.*')
    .orderBy('pi.created_at', 'asc');

  const linked_debit_notes = await Promise.all(
    debitNotesRows.map(async (dn) => {
      const dnItems = await db('purchase_invoice_items as pii')
        .join('products as p', 'pii.product_id', 'p.id')
        .where('pii.purchase_invoice_id', dn.id)
        .select('pii.*', 'p.name as product_name', 'p.code as product_code');
      return { ...dn, items: dnItems };
    })
  );

  const returned_total = (linked_debit_notes || []).reduce(
    (sum: number, dn: any) => sum + Math.abs(Number(dn.total_amount || 0)),
    0
  );

  const hasReturnsFlag = Boolean(invoice.has_returns) || returned_total > 0;
  const net_invoice_total = invoice.has_returns
    ? Number(invoice.total_amount || 0)
    : Math.round((Number(invoice.total_amount || 0) - returned_total) * 100) / 100;

  const original_total = invoice.has_returns
    ? Math.round((Number(invoice.total_amount || 0) + returned_total) * 100) / 100
    : Number(invoice.total_amount || 0);

  const amount_paid = Number(invoice.paid_amount || invoice.amount_paid || 0);
  // CRITICAL: True net balance without Math.max(0, ...). Allow negative numbers for OVERPAID state.
  const balance_due = (invoice.balance_due !== undefined && invoice.balance_due !== null)
    ? Number(invoice.balance_due)
    : Math.round((net_invoice_total - amount_paid) * 100) / 100;

  invoice.has_returns = hasReturnsFlag;
  invoice.total_amount = net_invoice_total;
  invoice.original_total = original_total;
  invoice.linked_returns_total = returned_total;
  invoice.net_total = net_invoice_total;
  invoice.net_invoice_total = net_invoice_total;
  invoice.paid_amount = amount_paid;
  invoice.amount_paid = amount_paid;
  invoice.balance_due = balance_due;
  invoice.status = invoice.status === 'CANCELLED'
    ? 'CANCELLED'
    : (balance_due <= 0 ? 'PAID' : (amount_paid > 0 ? 'PARTIAL' : 'UNPAID'));

  const hasAllocationsTable = await db.schema.hasTable('supplier_payment_allocations');
  const allocatedPayments = hasAllocationsTable
    ? await db('supplier_payment_allocations as spa')
        .join('supplier_payments as sp', 'spa.payment_id', 'sp.id')
        .where('spa.purchase_invoice_id', id)
        .select(
          'sp.id',
          'spa.purchase_invoice_id',
          'sp.payment_number',
          'sp.payment_date',
          'spa.allocated_amount as amount',
          'sp.payment_method',
          'sp.notes',
          'sp.cheque_number',
          'sp.created_at'
        )
        .orderBy('sp.payment_date', 'asc')
        .orderBy('sp.created_at', 'asc')
    : [];

  const directPayments = await db('supplier_payments')
    .where('purchase_invoice_id', id)
    .select(
      'id',
      'purchase_invoice_id',
      'payment_number',
      'payment_date',
      'amount',
      'payment_method',
      'notes',
      'cheque_number',
      'created_at'
    )
    .orderBy('payment_date', 'asc')
    .orderBy('created_at', 'asc');

  const payments: any[] = [];
  const seenPaymentIds = new Set<string>();
  for (const p of [...allocatedPayments, ...directPayments]) {
    if (!seenPaymentIds.has(p.id)) {
      seenPaymentIds.add(p.id);
      payments.push({
        id: p.id,
        payment_date: p.payment_date,
        amount: Number(p.amount || 0),
        payment_method: p.payment_method,
        payment_number: p.payment_number,
        reference_number: p.payment_number || p.cheque_number || p.notes || '',
        reference_notes: p.notes || '',
        notes: p.notes || '',
        cheque_number: p.cheque_number || null,
      });
    }
  }

  invoice.payments = payments;
  invoice.supplier_payments = payments;

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

  return { ...invoice, items, linked_debit_notes };
}

function sanitizePurchaseItems(items: any[]) {
  return (items || []).map((item: any) => {
    const quantity_kg = Number((item.quantity_kg ?? item.quantity) || 0);
    const rawUnitPrice = item.price_per_kg ?? item.unit_price ?? item.price ?? 0;
    const unit_price = Math.round(Number(rawUnitPrice) * 100) / 100;
    const total_price = item.total_price !== undefined || item.total !== undefined
      ? Math.round(Number(item.total_price ?? item.total) * 100) / 100
      : Math.round((quantity_kg * unit_price) * 100) / 100;

    return {
      ...item,
      quantity_kg,
      unit_price,
      price_per_kg: unit_price,
      total_price,
      total: total_price,
    };
  });
}

async function applyNewPurchaseItemInventory(
  trx: Knex.Transaction,
  params: {
    invoice: { id: string; invoice_number: string };
    item: any;
    index: number;
    freightPerKg: number;
    createdBy?: string | null;
    hasBatchBuyPriceCol: boolean;
  }
) {
  const { invoice, item, index, freightPerKg, createdBy, hasBatchBuyPriceCol } = params;
  const quantity_kg = item.quantity_kg;
  const base_price_per_kg = item.unit_price;
  const itemTotal = item.total_price;

  const item_dc_per_kg = Math.round(freightPerKg * 10000) / 10000;
  // Landed cost includes delivery charges allocated per kg
  const price_per_kg = Math.round((base_price_per_kg + item_dc_per_kg) * 100) / 100;

  // Fetch Product with write lock for concurrency safety
  const productWithCat = await trx('products as p')
    .where('p.id', item.product_id)
    .forUpdate()
    .select('p.id', 'p.name', 'p.size', 'p.total_stock_kg', 'p.rolling_avg_cost_per_kg')
    .first();

  if (!productWithCat) {
    throw new Error(`Product not found for product ID ${item.product_id}`);
  }

  const incoming_kg = quantity_kg;
  const purchase_cost_per_kg = price_per_kg;

  // ── Rolling Auto-Reconciliation (The Interceptor) ──
  // Scan pending_deliveries queue FIFO and instantly fulfill waiting orders before stock hits general warehouse shelves
  const pendingQueue = await trx('pending_deliveries')
    .where('product_id', item.product_id)
    .whereIn('status', ['PENDING', 'PARTIAL'])
    .orderBy('created_at', 'asc') // Oldest first (FIFO fulfillment)
    .forUpdate();

  let availableIncomingKg = incoming_kg;

  for (const delivery of pendingQueue) {
    if (availableIncomingKg <= 0) break;

    const currentPending = Number(delivery.pending_qty || 0);
    if (currentPending <= 0) continue;

    let qtyToDeliver = 0;
    let newPendingQty = 0;
    let newFulfilledQty = Number(delivery.fulfilled_qty || 0);
    let newStatus: 'PARTIAL' | 'FULFILLED' = 'FULFILLED';

    if (availableIncomingKg >= currentPending) {
      qtyToDeliver = currentPending;
      availableIncomingKg -= currentPending;
      newPendingQty = 0;
      newFulfilledQty += qtyToDeliver;
      newStatus = 'FULFILLED';
    } else {
      qtyToDeliver = availableIncomingKg;
      newPendingQty = currentPending - qtyToDeliver;
      newFulfilledQty += qtyToDeliver;
      availableIncomingKg = 0;
      newStatus = 'PARTIAL';
    }

    await trx('pending_deliveries')
      .where('id', delivery.id)
      .update({
        pending_qty: newPendingQty,
        fulfilled_qty: newFulfilledQty,
        status: newStatus,
        updated_at: new Date(),
      });

    const deliveryActualCost = Math.round(qtyToDeliver * purchase_cost_per_kg * 100) / 100;

    let targetItemId = delivery.sales_invoice_item_id;
    if (!targetItemId) {
      const fallbackItem = await trx('sales_invoice_items')
        .where({ invoice_id: delivery.sales_invoice_id, product_id: delivery.product_id })
        .first();
      targetItemId = fallbackItem?.id;
    }

    if (targetItemId) {
      const invoiceItem = await trx('sales_invoice_items')
        .where('id', targetItemId)
        .first();

      if (invoiceItem) {
        const currentActualCogs = Number(invoiceItem.actual_cogs || 0);
        const updatedActualCogs = Math.round((currentActualCogs + deliveryActualCost) * 100) / 100;

        const updatePayload: any = {
          actual_cogs: updatedActualCogs,
          updated_at: new Date(),
        };

        if (newStatus === 'FULFILLED') {
          const remainingForThisItem = await trx('pending_deliveries')
            .where('sales_invoice_item_id', targetItemId)
            .whereIn('status', ['PENDING', 'PARTIAL'])
            .first();

          if (!remainingForThisItem) {
            updatePayload.estimated_cogs = updatedActualCogs;
            const soldKg = Number(invoiceItem.net_kg_processed || invoiceItem.quantity || 1);
            if (soldKg > 0) {
              updatePayload.applied_cogs_per_kg = Math.round((updatedActualCogs / soldKg) * 10000) / 10000;
            }
          }
        } else {
          const currentEstimated = Number(invoiceItem.estimated_cogs || 0);
          const placeholderRate = currentPending > 0
            ? Math.max(0, (currentEstimated - currentActualCogs) / currentPending)
            : purchase_cost_per_kg;
          const newEstimatedCogs = Math.round((updatedActualCogs + (newPendingQty * placeholderRate)) * 100) / 100;
          updatePayload.estimated_cogs = newEstimatedCogs;
          const soldKg = Number(invoiceItem.net_kg_processed || invoiceItem.quantity || 1);
          if (soldKg > 0) {
            updatePayload.applied_cogs_per_kg = Math.round((newEstimatedCogs / soldKg) * 10000) / 10000;
          }
        }

        await trx('sales_invoice_items')
          .where('id', targetItemId)
          .update(updatePayload);
      }
    }

    const parentSalesInvoice = await trx('sales_invoices')
      .where('id', delivery.sales_invoice_id)
      .select('invoice_number')
      .first();

    await trx('inventory_transactions').insert({
      product_id: item.product_id,
      transaction_type: 'SALE',
      quantity_kg: qtyToDeliver,
      unit_cost: purchase_cost_per_kg,
      total_asset_value: deliveryActualCost,
      capital_equity_value: 0,
      notes: `Rolling Fulfillment: Direct Dispatch ${qtyToDeliver} KG from Purchase ${invoice.invoice_number} to Sales Invoice ${parentSalesInvoice?.invoice_number || delivery.sales_invoice_id}`,
      created_by: createdBy || null,
    });
  }

  // Remainder of incoming batch (if any) to standard available warehouse inventory
  const remainder_kg = availableIncomingKg;

  // ── Weighted Average Costing (WAC) Formula for remainder ──
  const currentStock = Number(productWithCat.total_stock_kg || 0);
  const currentAvgCost = Number(productWithCat.rolling_avg_cost_per_kg || 0);

  const currentTotalVal = currentStock * currentAvgCost;
  const remainderVal = remainder_kg * purchase_cost_per_kg;
  const newTotalStock = currentStock + remainder_kg;

  const newRollingAvg = newTotalStock > 0
    ? Math.round(((currentTotalVal + remainderVal) / newTotalStock) * 10000) / 10000
    : (currentAvgCost > 0 ? currentAvgCost : purchase_cost_per_kg);

  await trx('products')
    .where('id', item.product_id)
    .update({
      total_stock_kg: newTotalStock,
      rolling_avg_cost_per_kg: newRollingAvg,
      cost_price: purchase_cost_per_kg,
      updated_at: new Date(),
    });

  // ── Dedicated Batch Creation Tied to Parent Purchase Invoice ──
  const landedCostPerKg = Math.round((item.unit_price + freightPerKg) * 100) / 100;
  const roundedCostPerKg = landedCostPerKg;
  const itemSize = (item.size && String(item.size).trim().length > 0)
    ? String(item.size).trim()
    : (productWithCat.size && String(productWithCat.size).trim().length > 0 ? String(productWithCat.size).trim() : 'Standard');
  const batchNum = `PB-${invoice.invoice_number || invoice.id.slice(0, 8)}-${item.product_id.slice(0, 4)}-${Date.now()}-${index + 1}`;

  const batchData: Record<string, any> = {
    product_id: item.product_id,
    purchase_invoice_id: invoice.id,
    batch_number: batchNum,
    batch_buy_price_per_kg: roundedCostPerKg,
    original_qty: incoming_kg,
    remaining_qty: remainder_kg,
    status: remainder_kg > 0 ? 'ACTIVE' : 'DEPLETED',
    size: itemSize,
  };

  if (!hasBatchBuyPriceCol) {
    batchData.buy_price_per_kg = roundedCostPerKg;
    delete batchData.batch_buy_price_per_kg;
  }

  await trx('inventory_batches').insert(batchData);

  return {
    purchase_invoice_id: invoice.id,
    product_id: item.product_id,
    size: itemSize,
    quantity: quantity_kg,
    selected_unit: item.selected_unit || 'KG',
    actual_weight_per_unit: 1.0,
    net_kg_processed: incoming_kg,
    net_kg_added: remainder_kg,
    actual_weight_kg: incoming_kg,
    unit_price: base_price_per_kg,
    total_price: itemTotal,
    delivery_charge_per_kg: item_dc_per_kg,
    landed_cost_per_kg: price_per_kg,
  };
}

async function recomputeProductsWac(
  trx: Knex.Transaction,
  productIds: Iterable<string>,
  hasBatchBuyPriceCol: boolean,
  productLatestCostOverride?: Map<string, number>
) {
  for (const productId of productIds) {
    const activeBatches = await trx('inventory_batches')
      .where('product_id', productId)
      .where('status', 'ACTIVE')
      .select('remaining_qty', hasBatchBuyPriceCol ? 'batch_buy_price_per_kg' : 'buy_price_per_kg');

    let totalRem = 0;
    let totalVal = 0;
    for (const b of activeBatches) {
      const rem = Number(b.remaining_qty || 0);
      const cost = Number(b.batch_buy_price_per_kg ?? b.buy_price_per_kg ?? 0);
      totalRem += rem;
      totalVal += rem * cost;
    }

    const updateFields: Record<string, any> = {
      updated_at: new Date(),
    };

    if (totalRem > 0) {
      updateFields.rolling_avg_cost_per_kg = Math.round((totalVal / totalRem) * 10000) / 10000;
    }

    if (productLatestCostOverride && productLatestCostOverride.has(productId)) {
      updateFields.cost_price = productLatestCostOverride.get(productId);
    } else if (productLatestCostOverride) {
      const latestBatch = await trx('inventory_batches')
        .where('product_id', productId)
        .whereNot('status', 'VOID')
        .orderBy('created_at', 'desc')
        .select(hasBatchBuyPriceCol ? 'batch_buy_price_per_kg' : 'buy_price_per_kg')
        .first();
      if (latestBatch) {
        updateFields.cost_price = Number(latestBatch.batch_buy_price_per_kg ?? latestBatch.buy_price_per_kg ?? 0);
      }
    }

    if (Object.keys(updateFields).length > 1) {
      await trx('products').where('id', productId).update(updateFields);
    }
  }
}

/**
 * Weighted Average Costing (WAC) Purchase Execution
 * Creates dedicated inventory batches with purchase_invoice_id foreign key.
 */
export async function createPurchaseInvoice(data: any, createdBy: string) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const invoice_number = await generatePurchaseInvoiceNumber();

    const sanitizedItems = sanitizePurchaseItems(data.items);

    let subtotal = 0;
    for (const item of sanitizedItems) {
      subtotal += item.total_price;
    }
    subtotal = Math.round(subtotal * 100) / 100;

    const discount = Math.round(Number(data.discount || 0) * 100) / 100;
    const delivery_charges = Math.round(Number(data.delivery_charges || 0) * 100) / 100;
    const total_amount = Math.round((subtotal - discount) * 100) / 100;

    const advanceApplied = Math.round(Number((data as any).advance_applied_amount || 0) * 100) / 100;
    const initialPaidAmount = advanceApplied;
    const invoiceStatus = initialPaidAmount >= total_amount ? 'PAID' : (initialPaidAmount > 0 ? 'PARTIAL' : 'UNPAID');

    // Landed Cost Formula: Proportional freight burden allocated across purchased plastic
    const totalInvoiceKg = sanitizedItems.reduce((sum: number, item: any) => sum + Number(item.quantity_kg || 0), 0);
    const freightPerKg = totalInvoiceKg > 0 ? (delivery_charges / totalInvoiceKg) : 0;

    // Phase 2: Severing the OPEX Double-Dip
    const initialBalanceDue = Math.round((total_amount - initialPaidAmount) * 100) / 100;
    const hasBalanceDue = await trx.schema.hasColumn('purchase_invoices', 'balance_due');
    const hasReturnsCol = await trx.schema.hasColumn('purchase_invoices', 'has_returns');

    const invoicePayload: Record<string, any> = {
      supplier_id: data.supplier_id,
      invoice_number,
      invoice_type: 'PURCHASE',
      date: data.date,
      due_date: data.due_date || null,
      subtotal,
      discount,
      delivery_charges,
      total_amount,
      paid_amount: initialPaidAmount,
      status: invoiceStatus,
      notes: data.notes || null,
      created_by: createdBy,
      expense_id: null,
    };
    if (hasBalanceDue) {
      invoicePayload.balance_due = initialBalanceDue;
    }
    if (hasReturnsCol) {
      invoicePayload.has_returns = false;
    }

    const [invoice] = await trx('purchase_invoices')
      .insert(invoicePayload)
      .returning('*');

    const hasBatchBuyPriceCol = await trx.schema.hasColumn('inventory_batches', 'batch_buy_price_per_kg');
    const itemsToInsert = [];

    for (let i = 0; i < sanitizedItems.length; i++) {
      const row = await applyNewPurchaseItemInventory(trx, {
        invoice,
        item: sanitizedItems[i],
        index: i,
        freightPerKg,
        createdBy,
        hasBatchBuyPriceCol,
      });
      itemsToInsert.push(row);
    }

    const insertedItems = await trx('purchase_invoice_items').insert(itemsToInsert).returning('*');

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

/**
 * Updates an existing purchase invoice and reconciles inventory, batches, WAC, and supplier payable balance atomically.
 */
export async function updatePurchaseInvoice(invoiceId: string, data: any, updatedBy: string) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const invoice = await trx('purchase_invoices')
      .where('id', invoiceId)
      .forUpdate()
      .first();

    if (!invoice) {
      throw new Error('Purchase invoice not found');
    }
    if (invoice.status === 'VOID' || invoice.status === 'CANCELLED') {
      throw new Error('Cannot edit a voided or cancelled purchase invoice.');
    }
    if (
      invoice.invoice_type === 'DEBIT_NOTE' ||
      invoice.invoice_type === 'RETURN' ||
      invoice.parent_invoice_id
    ) {
      throw new Error('Cannot edit a Debit Note / Return invoice.');
    }

    const activeDebitNotes = await trx('purchase_invoices')
      .where('parent_invoice_id', invoiceId)
      .where(function () {
        this.whereIn('invoice_type', ['DEBIT_NOTE', 'RETURN'])
          .orWhere('invoice_number', 'like', 'DN-%');
      })
      .whereNotIn('status', ['VOID', 'CANCELLED']);

    if (activeDebitNotes.length > 0) {
      throw new Error('Cannot edit purchase invoice: it has active return/debit note(s) attached.');
    }

    // Prevent changing supplier when payments are already linked to this invoice
    if (data.supplier_id !== invoice.supplier_id) {
      let hasPayments = Number(invoice.paid_amount || 0) > 0;
      if (!hasPayments && (await trx.schema.hasTable('supplier_payment_allocations'))) {
        const alloc = await trx('supplier_payment_allocations')
          .where('purchase_invoice_id', invoiceId)
          .first();
        if (alloc) hasPayments = true;
      }
      if (!hasPayments && (await trx.schema.hasTable('supplier_payments'))) {
        const pmt = await trx('supplier_payments')
          .where('purchase_invoice_id', invoiceId)
          .first();
        if (pmt) hasPayments = true;
      }
      if (hasPayments) {
        throw new Error('Cannot change supplier because payments are already recorded against this invoice.');
      }
    }

    const sanitizedItems = sanitizePurchaseItems(data.items);
    let subtotal = 0;
    for (const item of sanitizedItems) {
      subtotal += item.total_price;
    }
    subtotal = Math.round(subtotal * 100) / 100;

    const discount = Math.round(Number(data.discount || 0) * 100) / 100;
    const delivery_charges = Math.round(Number(data.delivery_charges || 0) * 100) / 100;
    const total_amount = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

    const totalInvoiceKg = sanitizedItems.reduce((sum: number, item: any) => sum + Number(item.quantity_kg || 0), 0);
    const freightPerKg = totalInvoiceKg > 0 ? (delivery_charges / totalInvoiceKg) : 0;

    const hasBatchBuyPriceCol = await trx.schema.hasColumn('inventory_batches', 'batch_buy_price_per_kg');
    const hasInvTx = await trx.schema.hasTable('inventory_transactions');
    const hasJunctionTable = await trx.schema.hasTable('sales_invoice_item_batches');

    const oldBatches = await trx('inventory_batches')
      .where('purchase_invoice_id', invoiceId)
      .orderBy('created_at', 'asc')
      .forUpdate();

    const batchIdsWithSalesLineage = new Set<string>();
    if (hasJunctionTable && oldBatches.length > 0) {
      const refs = await trx('sales_invoice_item_batches')
        .whereIn('inventory_batch_id', oldBatches.map((b: any) => b.id))
        .select('inventory_batch_id');
      refs.forEach((r: any) => {
        if (r.inventory_batch_id) batchIdsWithSalesLineage.add(r.inventory_batch_id);
      });
    }

    // Partition old batches into used (cannot be deleted) and untouched (can be safely reversed & deleted)
    const usedBatchToItemIdx = new Map<string, number>();
    const matchedItemIndices = new Set<number>();

    for (const batch of oldBatches) {
      const orig = Number(batch.original_qty || 0);
      const rem = Number(batch.remaining_qty || 0);
      const usedQty = Math.max(0, orig - rem);
      const isUsed = usedQty > 0.0001 || batchIdsWithSalesLineage.has(batch.id);

      if (!isUsed) continue;

      // Prefer an unmatched incoming item for the same product whose quantity satisfies usedQty
      let matchIdx = sanitizedItems.findIndex(
        (it: any, idx: number) =>
          !matchedItemIndices.has(idx) &&
          it.product_id === batch.product_id &&
          it.quantity_kg >= usedQty - 0.0001
      );

      if (matchIdx === -1) {
        matchIdx = sanitizedItems.findIndex(
          (it: any, idx: number) => !matchedItemIndices.has(idx) && it.product_id === batch.product_id
        );
      }

      const prod = await trx('products').where('id', batch.product_id).select('name').first();
      const prodName = prod?.name || batch.product_id;

      if (matchIdx === -1) {
        throw new Error(
          `Cannot remove "${prodName}" because ${usedQty.toFixed(2)} KG from this purchase has already been sold or dispatched.`
        );
      }

      const matchedItem = sanitizedItems[matchIdx];
      if (matchedItem.quantity_kg < usedQty - 0.0001) {
        throw new Error(
          `Cannot reduce quantity of "${prodName}" below ${usedQty.toFixed(2)} KG because ${usedQty.toFixed(2)} KG from this purchase has already been sold or dispatched.`
        );
      }

      matchedItemIndices.add(matchIdx);
      usedBatchToItemIdx.set(batch.id, matchIdx);
    }

    const touchedProductIds = new Set<string>();
    const productLatestCostOverride = new Map<string, number>();
    const itemsToInsert: any[] = [];

    // 1. Reverse & delete untouched batches; adjust used batches in place
    for (const batch of oldBatches) {
      const matchedIdx = usedBatchToItemIdx.get(batch.id);

      if (matchedIdx === undefined) {
        const oldRem = Number(batch.remaining_qty || 0);
        const buyPrice = Number(batch.batch_buy_price_per_kg ?? batch.buy_price_per_kg ?? 0);

        if (batch.product_id) {
          await trx('products').where('id', batch.product_id).forUpdate().first();
          touchedProductIds.add(batch.product_id);

          if (oldRem > 0) {
            await trx('products')
              .where('id', batch.product_id)
              .update({
                total_stock_kg: trx.raw('GREATEST(0, COALESCE(total_stock_kg, 0) - ?)', [oldRem]),
                updated_at: new Date(),
              });

            if (hasInvTx) {
              await trx('inventory_transactions').insert({
                product_id: batch.product_id,
                transaction_type: 'ADJUSTMENT',
                quantity_kg: -oldRem,
                unit_cost: buyPrice,
                total_asset_value: -(oldRem * buyPrice),
                capital_equity_value: 0,
                notes: `Purchase Edit Reversal: ${invoice.invoice_number}`,
                created_by: updatedBy || null,
              });
            }
          }
        }

        await trx('inventory_batches').where('id', batch.id).del();
      } else {
        const item = sanitizedItems[matchedIdx];
        const productRow = await trx('products')
          .where('id', item.product_id)
          .forUpdate()
          .select('id', 'name', 'size')
          .first();

        if (!productRow) {
          throw new Error(`Product not found for product ID ${item.product_id}`);
        }

        const oldOrig = Number(batch.original_qty || 0);
        const oldRem = Number(batch.remaining_qty || 0);
        const usedQty = Math.max(0, oldOrig - oldRem);
        const newOrig = item.quantity_kg;
        const newRem = Math.max(0, Math.round((newOrig - usedQty) * 10000) / 10000);
        const stockDelta = Math.round((newRem - oldRem) * 10000) / 10000;

        const item_dc_per_kg = Math.round(freightPerKg * 10000) / 10000;
        const landedCostPerKg = Math.round((item.unit_price + item_dc_per_kg) * 100) / 100;
        const itemSize = (item.size && String(item.size).trim().length > 0)
          ? String(item.size).trim()
          : (productRow.size && String(productRow.size).trim().length > 0 ? String(productRow.size).trim() : 'Standard');

        if (Math.abs(stockDelta) > 0.0001) {
          await trx('products')
            .where('id', item.product_id)
            .update({
              total_stock_kg: trx.raw('GREATEST(0, COALESCE(total_stock_kg, 0) + ?)', [stockDelta]),
              updated_at: new Date(),
            });

          if (hasInvTx) {
            await trx('inventory_transactions').insert({
              product_id: item.product_id,
              transaction_type: 'ADJUSTMENT',
              quantity_kg: stockDelta,
              unit_cost: landedCostPerKg,
              total_asset_value: Math.round(stockDelta * landedCostPerKg * 100) / 100,
              capital_equity_value: 0,
              notes: `Purchase Edit Qty Adjustment: ${invoice.invoice_number}`,
              created_by: updatedBy || null,
            });
          }
        }

        const batchUpdate: Record<string, any> = {
          original_qty: newOrig,
          remaining_qty: newRem,
          status: newRem > 0 ? 'ACTIVE' : 'DEPLETED',
          size: itemSize,
          updated_at: new Date(),
        };
        if (hasBatchBuyPriceCol) {
          batchUpdate.batch_buy_price_per_kg = landedCostPerKg;
        } else {
          batchUpdate.buy_price_per_kg = landedCostPerKg;
        }

        await trx('inventory_batches').where('id', batch.id).update(batchUpdate);

        touchedProductIds.add(item.product_id);
        productLatestCostOverride.set(item.product_id, landedCostPerKg);

        itemsToInsert.push({
          purchase_invoice_id: invoiceId,
          product_id: item.product_id,
          size: itemSize,
          quantity: newOrig,
          selected_unit: item.selected_unit || 'KG',
          actual_weight_per_unit: 1.0,
          net_kg_processed: newOrig,
          net_kg_added: newRem,
          actual_weight_kg: newOrig,
          unit_price: item.unit_price,
          total_price: item.total_price,
          delivery_charge_per_kg: item_dc_per_kg,
          landed_cost_per_kg: landedCostPerKg,
        });
      }
    }

    // 2. Apply newly added or replaced incoming items
    const newlyAppliedRows: any[] = [];
    for (let i = 0; i < sanitizedItems.length; i++) {
      if (matchedItemIndices.has(i)) continue;
      const item = sanitizedItems[i];
      const row = await applyNewPurchaseItemInventory(trx, {
        invoice,
        item,
        index: i,
        freightPerKg,
        createdBy: updatedBy,
        hasBatchBuyPriceCol,
      });
      itemsToInsert.push(row);
      newlyAppliedRows.push(row);
      touchedProductIds.add(item.product_id);
      productLatestCostOverride.set(item.product_id, row.landed_cost_per_kg);
    }

    // 3. Recompute rolling WAC & cost_price for all touched products
    await recomputeProductsWac(trx, touchedProductIds, hasBatchBuyPriceCol, productLatestCostOverride);

    // 4. Replace purchase_invoice_items
    await trx('purchase_invoice_items').where('purchase_invoice_id', invoiceId).del();
    const insertedNewItems = await trx('purchase_invoice_items').insert(itemsToInsert).returning('*');

    if (hasInvTx && newlyAppliedRows.length > 0) {
      for (const pii of newlyAppliedRows) {
        const product = await trx('products').where('id', pii.product_id).select('rolling_avg_cost_per_kg').first();
        const avgCost = Number(product?.rolling_avg_cost_per_kg || 0);
        await trx('inventory_transactions').insert({
          product_id: pii.product_id,
          transaction_type: 'PURCHASE',
          quantity_kg: pii.net_kg_processed,
          unit_cost: avgCost,
          total_asset_value: Number(pii.total_price),
          capital_equity_value: 0,
          notes: `Purchase Invoice ${invoice.invoice_number} (Edited: ${pii.quantity} KG @ ${pii.unit_price}/KG)`,
          created_by: updatedBy || null,
        });
      }
    }

    // 5. Clear any legacy OPEX bridge if present
    if (invoice.expense_id) {
      await trx('expenses').where('id', invoice.expense_id).del();
    }

    // 6. Update purchase_invoices header preserving existing paid_amount
    const paidAmount = Number(invoice.paid_amount || 0);
    const newBalanceDue = Math.round((total_amount - paidAmount) * 100) / 100;
    const newStatus = newBalanceDue <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID');

    const updatePayload: Record<string, any> = {
      supplier_id: data.supplier_id,
      date: data.date,
      due_date: data.due_date || null,
      subtotal,
      discount,
      delivery_charges,
      total_amount,
      status: newStatus,
      notes: data.notes || null,
      expense_id: null,
      updated_at: new Date(),
    };
    const hasBalanceDue = await trx.schema.hasColumn('purchase_invoices', 'balance_due');
    if (hasBalanceDue) {
      updatePayload.balance_due = newBalanceDue;
    }

    const [updatedInvoice] = await trx('purchase_invoices')
      .where('id', invoiceId)
      .update(updatePayload)
      .returning('*');

    return { ...updatedInvoice, items: insertedNewItems };
  });
}

/**
 * Phase 1 & Phase 2: Targeted Inventory Destruction & Debit Note Generation
 *
 * 1. Targeted Batch Deduction: Find exact inventory_batch created by parent_invoice_id.
 * 2. Double-Spend Protection: if (batch.remaining_qty < returnedQty) throw new Error('STOCK_ALREADY_SOLD')
 * 3. Execution: Deduct returnedQty from BOTH remaining_qty AND original_qty.
 *    If remaining_qty hits 0, set status to 'DEPLETED'.
 * 4. Deduct warehouse physical stock from products.total_stock_kg.
 * 5. Insert new row into purchase_invoices with invoice_type = 'DEBIT_NOTE', linked to parent_invoice_id.
 * 6. Save line items with negative quantities and negative totals.
 */
export interface PurchaseReturnItemInput {
  product_id: string;
  return_quantity?: number;
  quantity?: number;
  id?: string;
  line_item_id?: string;
}

export async function processPurchaseReturn(
  input: {
    parent_invoice_id: string;
    items?: PurchaseReturnItemInput[];
    line_items?: PurchaseReturnItemInput[];
    return_reason?: string;
  },
  userId?: string
) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const parentInvoiceId = input.parent_invoice_id;
    const parentInvoice = await trx('purchase_invoices').where('id', parentInvoiceId).first();
    if (!parentInvoice) {
      throw new Error('Parent purchase invoice not found.');
    }
    if (parentInvoice.invoice_type === 'DEBIT_NOTE') {
      throw new Error('Cannot process return against a Debit Note.');
    }

    const parentItems = await trx('purchase_invoice_items as pii')
      .join('products as p', 'pii.product_id', 'p.id')
      .where('pii.purchase_invoice_id', parentInvoiceId)
      .select('pii.*', 'p.name as product_name', 'p.rolling_avg_cost_per_kg');

    const existingDebitNotes = await trx('purchase_invoices as pi')
      .join('purchase_invoice_items as pii', 'pi.id', 'pii.purchase_invoice_id')
      .where('pi.parent_invoice_id', parentInvoiceId)
      .where('pi.invoice_type', 'DEBIT_NOTE')
      .whereNotIn('pi.status', ['CANCELLED', 'VOID'])
      .select('pii.product_id', trx.raw('SUM(ABS(pii.quantity)) as total_returned_qty'))
      .groupBy('pii.product_id');

    const returnMap = new Map<string, number>();
    for (const ret of existingDebitNotes) {
      returnMap.set(ret.product_id, Number(ret.total_returned_qty || 0));
    }

    const hasReturnedQtyCol = await trx.schema.hasColumn('purchase_invoice_items', 'returned_quantity');
    if (!hasReturnedQtyCol) {
      await trx.schema.alterTable('purchase_invoice_items', (table) => {
        table.decimal('returned_quantity', 14, 4).notNullable().defaultTo(0);
      });
    }

    const returnedItems = input.line_items || input.items || [];
    let totalDebitAmount = 0;
    const itemsToInsert: any[] = [];

    for (const itemInput of returnedItems) {
      const returnedQty = Number(itemInput.return_quantity ?? itemInput.quantity ?? 0);
      if (returnedQty <= 0) continue;

      const parentItem = parentItems.find((p) =>
        (itemInput.id && p.id === itemInput.id) ||
        (itemInput.line_item_id && p.id === itemInput.line_item_id) ||
        p.product_id === itemInput.product_id
      );
      if (!parentItem) {
        throw new Error(`Product ${itemInput.product_id} was not billed on the parent invoice.`);
      }

      const originalQty = Math.abs(Number(parentItem.quantity || 0));
      const previouslyReturned = returnMap.get(itemInput.product_id) || 0;
      const remainingReturnable = originalQty - previouslyReturned;

      if (returnedQty > remainingReturnable + 0.0001) {
        throw new Error(
          `Return quantity for ${parentItem.product_name} exceeds remaining returnable quantity on parent invoice (Requested: ${returnedQty}, Available: ${remainingReturnable}).`
        );
      }

      // ── Targeted Batch Deduction ──
      // Query the exact inventory_batch created by parent_invoice_id for that specific product_id
      let batch = await trx('inventory_batches')
        .where('product_id', itemInput.product_id)
        .where('purchase_invoice_id', parentInvoiceId)
        .first();

      // Graceful fallback for legacy batches created prior to foreign key stamping
      if (!batch) {
        batch = await trx('inventory_batches')
          .where('product_id', itemInput.product_id)
          .where('remaining_qty', '>', 0)
          .orderBy('created_at', 'desc')
          .first();
      }

      // ── Validation Wall: Double-Spend Protection ──
      if (!batch || Number(batch.remaining_qty) < returnedQty) {
        throw new Error('STOCK_ALREADY_SOLD');
      }

      // ── Execution: Deduct returnedQty from BOTH remaining_qty AND original_qty ──
      const currentRemaining = Number(batch.remaining_qty);
      const currentOriginal = Number(batch.original_qty);
      const newRemaining = Math.max(0, currentRemaining - returnedQty);
      const newOriginal = Math.max(0, currentOriginal - returnedQty);
      const newStatus = newOriginal === 0 ? 'RETURNED' : (newRemaining <= 0 ? 'DEPLETED' : (batch.status || 'ACTIVE'));

      await trx('inventory_batches')
        .where('id', batch.id)
        .update({
          remaining_qty: newRemaining,
          original_qty: newOriginal,
          status: newStatus,
          updated_at: new Date(),
        });

      // Increment Line Items: Mathematically increment returned_quantity column
      const targetLineItemId = itemInput.id || itemInput.line_item_id || parentItem.id;
      await trx.raw(
        'UPDATE purchase_invoice_items SET returned_quantity = returned_quantity + ? WHERE id = ?',
        [returnedQty, targetLineItemId]
      );

      const unitMultiplier = Number(parentItem.actual_weight_per_unit || 1.0);
      const returnKg = returnedQty * unitMultiplier;
      const unitPrice = Math.round(Number(parentItem.unit_price || 0) * 100) / 100;
      const lineTotal = Math.round((returnedQty * unitPrice) * 100) / 100;

      totalDebitAmount = Math.round((totalDebitAmount + lineTotal) * 100) / 100;

      // Deduct warehouse physical capacity
      await trx('products')
        .where('id', itemInput.product_id)
        .update({
          total_stock_kg: trx.raw('GREATEST(0, total_stock_kg - ?)', [returnKg]),
          updated_at: new Date(),
        });

      // Record RETURN inventory transaction for audit log
      await trx('inventory_transactions').insert({
        product_id: itemInput.product_id,
        transaction_type: 'RETURN',
        quantity_kg: -Math.abs(returnKg),
        unit_cost: Number(batch.batch_buy_price_per_kg || parentItem.unit_price || 0),
        total_asset_value: -Math.abs(lineTotal),
        capital_equity_value: 0,
        notes: `Purchase Return Debit Note (Parent: ${parentInvoice.invoice_number}) - Reason: ${input.return_reason || 'Goods Returned to Supplier'}`,
        created_by: userId,
      });

      itemsToInsert.push({
        product_id: itemInput.product_id,
        quantity: -Math.abs(returnedQty),
        selected_unit: parentItem.selected_unit || 'KG',
        actual_weight_per_unit: unitMultiplier,
        net_kg_processed: -Math.abs(returnKg),
        net_kg_added: -Math.abs(returnKg),
        actual_weight_kg: -Math.abs(returnKg),
        unit_price: unitPrice,
        total_price: -Math.abs(lineTotal),
      });
    }

    if (itemsToInsert.length === 0) {
      throw new Error('At least one item must have a return quantity greater than 0.');
    }

    const debitNoteNumber = await generateNextDebitNoteNumber(trx);

    const hasBalanceDue = await trx.schema.hasColumn('purchase_invoices', 'balance_due');
    const hasReturnsCol = await trx.schema.hasColumn('purchase_invoices', 'has_returns');

    // Insert new row into purchase_invoices with invoice_type = 'DEBIT_NOTE'
    const debitNotePayload: Record<string, any> = {
      supplier_id: parentInvoice.supplier_id,
      invoice_number: debitNoteNumber,
      parent_invoice_id: parentInvoiceId,
      invoice_type: 'DEBIT_NOTE',
      return_reason: input.return_reason || null,
      date: new Date().toISOString().split('T')[0],
      due_date: null,
      subtotal: -Math.abs(totalDebitAmount),
      discount: 0,
      total_amount: -Math.abs(totalDebitAmount),
      paid_amount: 0,
      status: 'UNPAID',
      notes: `Debit Note against ${parentInvoice.invoice_number} — Reason: ${input.return_reason || 'Goods Returned to Supplier'}`,
      created_by: userId,
    };
    if (hasBalanceDue) {
      debitNotePayload.balance_due = -Math.abs(totalDebitAmount);
    }
    if (hasReturnsCol) {
      debitNotePayload.has_returns = false;
    }

    const [debitNote] = await trx('purchase_invoices')
      .insert(debitNotePayload)
      .returning('*');

    const finalItems = itemsToInsert.map((item) => ({
      ...item,
      purchase_invoice_id: debitNote.id,
    }));

    await trx('purchase_invoice_items').insert(finalItems);

    // ── Phase 1: Parent Purchase Invoice Status Flagging ──
    // Keep the DEBIT_NOTE row as the single accounting record of the return without mutating parent total_amount
    const parentUpdatePayload: Record<string, any> = {
      updated_at: new Date(),
    };

    if (hasReturnsCol) {
      parentUpdatePayload.has_returns = true;
    }

    await trx('purchase_invoices')
      .where('id', parentInvoiceId)
      .update(parentUpdatePayload);

    return { ...debitNote, items: finalItems };
  });
}

export async function getPurchaseInvoiceReturnSummary(parentInvoiceId: string) {
  const invoice = await findPurchaseInvoiceById(parentInvoiceId);
  if (!invoice) throw new Error('Parent purchase invoice not found.');

  const parentItems = await db('purchase_invoice_items as pii')
    .join('products as p', 'pii.product_id', 'p.id')
    .where('pii.purchase_invoice_id', parentInvoiceId)
    .select(
      'pii.*',
      'p.name as product_name',
      'p.code as product_code',
      'p.size as product_size'
    );

  const existingDebitNotes = await db('purchase_invoices as pi')
    .join('purchase_invoice_items as pii', 'pi.id', 'pii.purchase_invoice_id')
    .where('pi.parent_invoice_id', parentInvoiceId)
    .where('pi.invoice_type', 'DEBIT_NOTE')
    .whereNotIn('pi.status', ['CANCELLED', 'VOID'])
    .select('pii.product_id', db.raw('SUM(ABS(pii.quantity)) as total_returned_qty'))
    .groupBy('pii.product_id');

  const returnMap = new Map<string, number>();
  for (const ret of existingDebitNotes) {
    returnMap.set(ret.product_id, Number(ret.total_returned_qty || 0));
  }

  const items = await Promise.all(
    parentItems.map(async (item: any) => {
      const originalQty = Math.abs(Number(item.quantity || 0));
      const itemReturnedQty = Number(item.returned_quantity || 0);
      const debitNoteReturnedQty = returnMap.get(item.product_id) || 0;
      const previouslyReturned = Math.max(itemReturnedQty, debitNoteReturnedQty);
      const remainingReturnable = Math.max(0, originalQty - previouslyReturned);

      // Check current remaining batch stock
      let batch = await db('inventory_batches')
        .where('purchase_invoice_id', parentInvoiceId)
        .where('product_id', item.product_id)
        .first();

      if (!batch) {
        batch = await db('inventory_batches')
          .where('product_id', item.product_id)
          .where('remaining_qty', '>', 0)
          .orderBy('created_at', 'desc')
          .first();
      }

      const batchRemaining = batch ? Number(batch.remaining_qty || 0) : 0;

      return {
        id: item.id,
        line_item_id: item.id,
        batch_id: batch?.id || item.id,
        purchase_invoice_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_code: item.product_code,
        product_size: item.product_size,
        selected_unit: item.selected_unit || 'KG',
        unit_price: Number(item.unit_price || 0),
        original_quantity: originalQty,
        previously_returned: previouslyReturned,
        returned_quantity: previouslyReturned,
        remaining_quantity: remainingReturnable,
        batch_remaining_qty: batchRemaining,
        can_return_qty: Math.min(remainingReturnable, batchRemaining),
      };
    })
  );

  return {
    parentInvoice: invoice,
    items,
  };
}

export async function updatePurchaseInvoiceStatus(
  id: string,
  updateData: { status?: string; paid_amount?: number; balance_due?: number; total_amount?: number; has_returns?: boolean }
) {
  const current = await db('purchase_invoices').where({ id }).first();
  const updatePayload: Record<string, any> = { ...updateData, updated_at: new Date() };

  if (updateData.paid_amount !== undefined && updateData.balance_due === undefined && current) {
    const total = Number(current.total_amount || 0);
    const hasBalanceDue = await db.schema.hasColumn('purchase_invoices', 'balance_due');
    if (hasBalanceDue) {
      updatePayload.balance_due = Math.round((total - updateData.paid_amount) * 100) / 100;
    }
  }

  const [updated] = await db('purchase_invoices')
    .where({ id })
    .update(updatePayload)
    .returning('*');
  return updated;
}

/**
 * Fetch recent purchases for Stock Update modal in Stocks page.
 * Includes items with base price, DC allocation, current landed cost, and product selling prices.
 */
export async function getRecentPurchasesForStockUpdate(limit: number = 20) {
  const purchases = await db('purchase_invoices as pi')
    .join('suppliers as s', 'pi.supplier_id', 's.id')
    .whereNull('pi.parent_invoice_id')
    .where(function() {
      this.whereNull('pi.invoice_type').orWhere('pi.invoice_type', 'PURCHASE');
    })
    .whereNotIn('pi.status', ['CANCELLED', 'VOID'])
    .select(
      'pi.id',
      'pi.invoice_number',
      'pi.date',
      'pi.created_at',
      'pi.subtotal',
      'pi.discount',
      'pi.total_amount',
      'pi.delivery_charges',
      'pi.expense_id',
      's.id as supplier_id',
      's.name as supplier_name'
    )
    .orderBy('pi.created_at', 'desc')
    .limit(limit);

  const purchaseIds = purchases.map((p) => p.id);
  if (purchaseIds.length === 0) return [];

  const items = await db('purchase_invoice_items as pii')
    .join('products as p', 'pii.product_id', 'p.id')
    .whereIn('pii.purchase_invoice_id', purchaseIds)
    .select(
      'pii.id',
      'pii.purchase_invoice_id',
      'pii.product_id',
      'pii.size',
      'pii.quantity',
      'pii.unit_price',
      'pii.total_price',
      'pii.delivery_charge_per_kg',
      'pii.landed_cost_per_kg',
      'p.name as product_name',
      'p.code as product_code',
      'p.cost_price as current_cost_price',
      'p.sale_price as current_sale_price',
      'p.fixed_retail_price_per_kg',
      'p.rolling_avg_cost_per_kg as current_wac',
      'p.total_stock_kg'
    );

  const itemsByPurchase = new Map<string, any[]>();
  for (const item of items) {
    const list = itemsByPurchase.get(item.purchase_invoice_id) || [];
    list.push({
      ...item,
      quantity_kg: Number(item.quantity || 0),
      base_unit_price: Number(item.unit_price || 0),
      delivery_charge_per_kg: Number(item.delivery_charge_per_kg || 0),
      landed_cost_per_kg: Number(item.landed_cost_per_kg || item.unit_price || 0),
      current_sale_price: Number(item.fixed_retail_price_per_kg || item.current_sale_price || 0),
      current_cost_price: Number(item.current_cost_price || 0),
      current_wac: Number(item.current_wac || 0),
      total_stock_kg: Number(item.total_stock_kg || 0),
    });
    itemsByPurchase.set(item.purchase_invoice_id, list);
  }

  return purchases.map((p) => {
    const pItems = itemsByPurchase.get(p.id) || [];
    const total_kg = pItems.reduce((acc, i) => acc + i.quantity_kg, 0);
    return {
      ...p,
      delivery_charges: Number(p.delivery_charges || 0),
      subtotal: Number(p.subtotal || 0),
      total_amount: Number(p.total_amount || 0),
      total_kg,
      items: pItems,
    };
  });
}

/**
 * Task 2: Update Stocks - Distribute DC across purchase items and update selling prices
 */
export async function updateStockDcAndPrices(
  purchaseId: string,
  payload: {
    delivery_charges?: number;
    items: Array<{
      product_id: string;
      selling_price: number;
    }>;
  },
  _userId?: string
) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const invoice = await trx('purchase_invoices').where('id', purchaseId).forUpdate().first();
    if (!invoice) {
      throw new Error('Purchase invoice not found');
    }

    const items = await trx('purchase_invoice_items')
      .where('purchase_invoice_id', purchaseId)
      .forUpdate();

    const invoiceBatches = await trx('inventory_batches')
      .where('purchase_invoice_id', purchaseId)
      .forUpdate();
    const sortedInvoiceBatches = Array.isArray(invoiceBatches)
      ? [...invoiceBatches].sort((a: any, b: any) => {
          const timeA = a?.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b?.created_at ? new Date(b.created_at).getTime() : 0;
          if (timeA !== timeB) return timeA - timeB;
          return String(a?.batch_number || '').localeCompare(String(b?.batch_number || ''));
        })
      : [];
    const usedBatchIds = new Set<string>();
    const hasBatchBuyPriceCol = await trx.schema.hasColumn('inventory_batches', 'batch_buy_price_per_kg');

    const totalKg = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const newDeliveryCharges = payload.delivery_charges !== undefined
      ? Math.round(Number(payload.delivery_charges) * 100) / 100
      : Number(invoice.delivery_charges || 0);

    const dcPerKg = totalKg > 0 ? (newDeliveryCharges / totalKg) : 0;

    // 1. Sever OPEX Bridge: Inbound freight is capitalized into inventory asset value, NOT in expenses.
    // If a legacy OPEX record exists, delete it so it does not double-dip in OPEX.
    if (invoice.expense_id) {
      await trx('expenses').where('id', invoice.expense_id).del();
    }

    await trx('purchase_invoices').where('id', purchaseId).update({
      delivery_charges: newDeliveryCharges,
      expense_id: null,
      updated_at: new Date(),
    });

    // 2. Update line items, inventory batches, and product rolling cost per kg
    for (const item of items) {
      const itemDcPerKg = Math.round(dcPerKg * 10000) / 10000;
      const basePrice = Number(item.unit_price || 0);
      const landedCost = Math.round((basePrice + itemDcPerKg) * 100) / 100;

      await trx('purchase_invoice_items')
        .where('id', item.id)
        .update({
          delivery_charge_per_kg: itemDcPerKg,
          landed_cost_per_kg: landedCost,
          updated_at: new Date(),
        });

      // Update only this line item's dedicated batch to prevent overwriting sibling rows for the same product
      const batchUpdate: Record<string, any> = {
        updated_at: new Date(),
      };
      if (hasBatchBuyPriceCol) {
        batchUpdate.batch_buy_price_per_kg = landedCost;
      } else {
        batchUpdate.buy_price_per_kg = landedCost;
      }

      const itemQty = Number(item.net_kg_processed ?? item.quantity ?? 0);
      const prevItemLandedCost = Number(item.landed_cost_per_kg ?? item.unit_price ?? 0);
      const candidateBatches = sortedInvoiceBatches.filter(
        (b: any) => b && b.id && !usedBatchIds.has(b.id) && b.product_id === item.product_id
      );
      const matchedBatch =
        candidateBatches.find(
          (b: any) =>
            Math.abs(Number(b.original_qty || 0) - itemQty) < 0.0001 &&
            Math.abs(Number(b.batch_buy_price_per_kg ?? b.buy_price_per_kg ?? 0) - prevItemLandedCost) < 0.01
        ) ||
        candidateBatches.find((b: any) => Math.abs(Number(b.original_qty || 0) - itemQty) < 0.0001) ||
        candidateBatches[0];

      if (matchedBatch) {
        usedBatchIds.add(matchedBatch.id);
        await trx('inventory_batches')
          .where('id', matchedBatch.id)
          .update(batchUpdate);
      } else {
        await trx('inventory_batches')
          .where({
            purchase_invoice_id: purchaseId,
            product_id: item.product_id,
          })
          .update(batchUpdate);
      }

      // Update product cost_price & rolling average cost
      const activeBatches = await trx('inventory_batches')
        .where('product_id', item.product_id)
        .where('status', 'ACTIVE')
        .select('remaining_qty', 'batch_buy_price_per_kg');

      let totalRem = 0;
      let totalVal = 0;
      for (const b of activeBatches) {
        const rem = Number(b.remaining_qty || 0);
        const cost = Number(b.batch_buy_price_per_kg || 0);
        totalRem += rem;
        totalVal += rem * cost;
      }
      const newRollingWac = totalRem > 0 ? Math.round((totalVal / totalRem) * 10000) / 10000 : landedCost;

      await trx('products')
        .where('id', item.product_id)
        .update({
          cost_price: landedCost,
          rolling_avg_cost_per_kg: newRollingWac,
          updated_at: new Date(),
        });
    }

    // 3. Update selling prices for all submitted products
    // "phir ham us ko usi hisab se selling price set kardenge or jo bhi hamari last changes hogin selling price wo hi consider ki jayengi"
    if (payload.items && Array.isArray(payload.items)) {
      for (const spItem of payload.items) {
        const sPrice = Math.round(Number(spItem.selling_price || 0) * 100) / 100;
        await trx('products')
          .where('id', spItem.product_id)
          .update({
            sale_price: sPrice,
            fixed_retail_price_per_kg: sPrice,
            updated_at: new Date(),
          });
      }
    }

    return {
      success: true,
      message: 'Stock delivery charges and selling prices updated successfully',
    };
  });
}

/**
 * Voids a purchase invoice and reverses associated inventory, batches, and payments.
 * Strictly executes within an atomic Knex transaction:
 * 1. Lock & Verify: SELECT * FROM purchase_invoices WHERE id = ? FOR UPDATE. Throws if missing or already VOID.
 * 2. Check Active Debit Notes: Cannot void if there are active debit notes linked to this invoice.
 * 3. Double-Spend Protection: Check inventory_batches for this purchase. If remaining_qty < original_qty - 0.0001, stock was already sold/dispatched.
 * 4. Stock Reversal: Deduct remaining_qty from products.total_stock_kg. Set batch status = 'VOID', remaining_qty = 0.
 * 5. Recompute Rolling WAC: Recalculate products.rolling_avg_cost_per_kg from remaining active batches.
 * 6. Audit Trail: Insert reversal record into inventory_transactions.
 * 7. Payment Unlinking: Clear purchase_invoice_id from supplier_payments (route to advance credit), delete supplier_payment_allocations.
 * 8. Status Update: Set purchase_invoices status = 'VOID', void_reason = voidReason, voided_at = trx.fn.now(), voided_by_user_id = userId, balance_due = 0.
 */
export async function voidPurchaseInvoice(
  invoiceId: string,
  voidReason?: string,
  userId?: string
): Promise<any> {
  return await db.transaction(async (trx) => {
    // 1. Lock & Verify
    const invoice = await trx('purchase_invoices')
      .where('id', invoiceId)
      .forUpdate()
      .first();

    if (!invoice) {
      throw new Error(`Purchase Invoice with ID ${invoiceId} not found`);
    }

    if (invoice.status === 'VOID') {
      throw new Error(`Purchase Invoice with ID ${invoiceId} is already VOID`);
    }

    if (invoice.status === 'CANCELLED') {
      throw new Error(`Purchase Invoice with ID ${invoiceId} is cancelled`);
    }

    // 2. Check Active Debit Notes
    const activeDebitNotes = await trx('purchase_invoices')
      .where('parent_invoice_id', invoiceId)
      .where('invoice_type', 'DEBIT_NOTE')
      .whereNotIn('status', ['VOID', 'CANCELLED']);

    if (activeDebitNotes.length > 0) {
      throw new Error('Cannot void purchase invoice: it has active debit note(s) attached. Please void or resolve debit notes first.');
    }

    // 3. Batches & Double-Spend Protection
    const batches = await trx('inventory_batches')
      .where('purchase_invoice_id', invoiceId);

    for (const batch of batches) {
      const orig = Number(batch.original_qty || 0);
      const rem = Number(batch.remaining_qty || 0);
      if (rem < orig - 0.0001) {
        throw new Error('STOCK_ALREADY_SOLD');
      }
    }

    // 4. Reverse Stock & Batches
    const hasInvTx = await trx.schema.hasTable('inventory_transactions');
    const touchedProductIds = new Set<string>();

    for (const batch of batches) {
      const rem = Number(batch.remaining_qty || 0);
      const buyPrice = Number(batch.batch_buy_price_per_kg ?? batch.buy_price_per_kg ?? 0);

      if (batch.product_id) {
        touchedProductIds.add(batch.product_id);

        if (rem > 0) {
          await trx('products')
            .where('id', batch.product_id)
            .update({
              total_stock_kg: trx.raw('GREATEST(0, COALESCE(total_stock_kg, 0) - ?)', [rem]),
              updated_at: new Date(),
            });

          if (hasInvTx) {
            await trx('inventory_transactions').insert({
              product_id: batch.product_id,
              transaction_type: 'ADJUSTMENT',
              quantity_kg: -rem,
              unit_cost: buyPrice,
              total_asset_value: -(rem * buyPrice),
              capital_equity_value: 0,
              notes: `Purchase Voided: Stock Reversal for Invoice ${invoice.invoice_number}`,
              created_by: userId || null,
            });
          }
        }
      }

      await trx('inventory_batches')
        .where('id', batch.id)
        .update({
          remaining_qty: 0,
          status: 'VOID',
          updated_at: new Date(),
        });
    }

    // 5. Recompute rolling WAC for touched products
    for (const productId of touchedProductIds) {
      const activeBatches = await trx('inventory_batches')
        .where('product_id', productId)
        .where('status', 'ACTIVE')
        .select('remaining_qty', 'batch_buy_price_per_kg', 'buy_price_per_kg');

      let totalRem = 0;
      let totalVal = 0;
      for (const b of activeBatches) {
        const rem = Number(b.remaining_qty || 0);
        const cost = Number(b.batch_buy_price_per_kg ?? b.buy_price_per_kg ?? 0);
        totalRem += rem;
        totalVal += rem * cost;
      }

      if (totalRem > 0) {
        const newRollingWac = Math.round((totalVal / totalRem) * 10000) / 10000;
        await trx('products')
          .where('id', productId)
          .update({
            rolling_avg_cost_per_kg: newRollingWac,
            updated_at: new Date(),
          });
      }
    }

    // 6. Payment Unlinking (convert supplier payments to advance balance)
    const hasSupplierPayments = await trx.schema.hasTable('supplier_payments');
    if (hasSupplierPayments) {
      const hasAllocationsTable = await trx.schema.hasTable('supplier_payment_allocations');
      const allocatedPaymentIds: string[] = [];
      if (hasAllocationsTable) {
        const allocations = await trx('supplier_payment_allocations')
          .where('purchase_invoice_id', invoiceId)
          .select('payment_id');
        allocations.forEach((a: any) => {
          if (a.payment_id) allocatedPaymentIds.push(a.payment_id);
        });
        await trx('supplier_payment_allocations')
          .where('purchase_invoice_id', invoiceId)
          .delete();
      }

      const hasIsAdvance = await trx.schema.hasColumn('supplier_payments', 'is_advance');
      const hasPaymentType = await trx.schema.hasColumn('supplier_payments', 'payment_type');

      const pmtUpdate: Record<string, any> = {
        purchase_invoice_id: null,
        updated_at: new Date(),
      };
      if (hasIsAdvance) pmtUpdate.is_advance = true;
      if (hasPaymentType) pmtUpdate.payment_type = 'ADVANCE';

      const pmtQuery = trx('supplier_payments');
      pmtQuery.where((qb) => {
        qb.where('purchase_invoice_id', invoiceId);
        if (allocatedPaymentIds.length > 0) {
          qb.orWhereIn('id', allocatedPaymentIds);
        }
      });
      await pmtQuery.update(pmtUpdate);
    }

    // 7. Update purchase invoice record
    const cleanedReason = typeof voidReason === 'string' && voidReason.trim().length > 0
      ? voidReason.trim()
      : null;

    const invoiceUpdatePayload: Record<string, any> = {
      status: 'VOID',
      void_reason: cleanedReason,
      voided_at: trx.fn.now(),
      updated_at: new Date(),
    };
    if (userId) {
      invoiceUpdatePayload.voided_by_user_id = userId;
    }

    const hasBalanceDue = await trx.schema.hasColumn('purchase_invoices', 'balance_due');
    if (hasBalanceDue) {
      invoiceUpdatePayload.balance_due = 0;
    }

    await trx('purchase_invoices')
      .where('id', invoiceId)
      .update(invoiceUpdatePayload);

    const [voidedInvoice] = await trx('purchase_invoices')
      .where('id', invoiceId)
      .select('*');

    return voidedInvoice;
  });
}

