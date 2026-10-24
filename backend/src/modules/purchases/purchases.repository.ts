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
      .whereNot('pi.status', 'CANCELLED')
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
    const original_total = Number(r.total_amount || 0);
    const returned_total = debitNotesTotalByInvoice.get(r.id) || 0;
    const net_invoice_total = Math.round((original_total - returned_total) * 100) / 100;
    const amount_paid = Number(r.paid_amount || r.amount_paid || 0);
    // CRITICAL: True net balance without Math.max(0, ...). Allow negative numbers for OVERPAID state.
    const balance_due = Math.round((net_invoice_total - amount_paid) * 100) / 100;
    const payments = paymentsByInvoice.get(r.id) || [];
    const linked_debit_notes = debitNotesByInvoice.get(r.id) || [];

    const dynamicStatus = r.status === 'CANCELLED'
      ? 'CANCELLED'
      : (balance_due <= 0 ? 'PAID' : (amount_paid > 0 ? 'PARTIAL' : 'UNPAID'));

    return {
      ...r,
      status: dynamicStatus,
      total_amount: original_total,
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

  const original_total = Number(invoice.total_amount || 0);
  const amount_paid = Number(invoice.paid_amount || invoice.amount_paid || 0);

  const linked_debit_notes = await db('purchase_invoices as pi')
    .where('pi.parent_invoice_id', id)
    .where('pi.invoice_type', 'DEBIT_NOTE')
    .whereNot('pi.status', 'CANCELLED')
    .select('pi.*')
    .orderBy('pi.created_at', 'asc');

  const returned_total = (linked_debit_notes || []).reduce(
    (sum: number, dn: any) => sum + Math.abs(Number(dn.total_amount || 0)),
    0
  );
  const net_invoice_total = Math.round((original_total - returned_total) * 100) / 100;
  // CRITICAL: Do NOT use Math.max(0, ...). Allow negative numbers for OVERPAID state.
  const balance_due = Math.round((net_invoice_total - amount_paid) * 100) / 100;

  invoice.total_amount = original_total;
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

/**
 * Weighted Average Costing (WAC) Purchase Execution
 * Creates dedicated inventory batches with purchase_invoice_id foreign key.
 */
export async function createPurchaseInvoice(data: any, createdBy: string) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const invoice_number = await generatePurchaseInvoiceNumber();

    // Map through the incoming array and force truncation to 2 decimal places
    const sanitizedItems = (data.items || []).map((item: any) => {
      const quantity_kg = Number((item.quantity_kg ?? item.quantity) || 0);
      const unit_price = Math.round(Number(item.price_per_kg ?? item.unit_price ?? 0) * 100) / 100;
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

    let subtotal = 0;
    for (const item of sanitizedItems) {
      subtotal += item.total_price;
    }
    subtotal = Math.round(subtotal * 100) / 100;

    const discount = Math.round(Number(data.discount || 0) * 100) / 100;
    const total_amount = Math.round((subtotal - discount) * 100) / 100;

    const advanceApplied = Math.round(Number((data as any).advance_applied_amount || 0) * 100) / 100;
    const initialPaidAmount = advanceApplied;
    const invoiceStatus = initialPaidAmount >= total_amount ? 'PAID' : (initialPaidAmount > 0 ? 'PARTIAL' : 'UNPAID');

    const [invoice] = await trx('purchase_invoices')
      .insert({
        supplier_id: data.supplier_id,
        invoice_number,
        invoice_type: 'PURCHASE',
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

    const itemsToInsert = [];

    for (let i = 0; i < sanitizedItems.length; i++) {
      const item = sanitizedItems[i];
      const quantity_kg = item.quantity_kg;
      const price_per_kg = item.unit_price;
      const itemTotal = item.total_price;

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
          // If incoming_qty >= pending_qty:
          // Deduct pending_qty from the incoming batch, mark the queue row as FULFILLED,
          // and update the original sales invoice actual_cogs with this new purchase price.
          qtyToDeliver = currentPending;
          availableIncomingKg -= currentPending;
          newPendingQty = 0;
          newFulfilledQty += qtyToDeliver;
          newStatus = 'FULFILLED';
        } else {
          // If incoming_qty < pending_qty:
          // Fulfill only the incoming_qty, update the queue row to PARTIAL,
          // deduct incoming_qty from the pending_qty, and update a proportional amount of the actual_cogs on the sales invoice.
          // The incoming batch is now 0.
          qtyToDeliver = availableIncomingKg;
          newPendingQty = currentPending - qtyToDeliver;
          newFulfilledQty += qtyToDeliver;
          availableIncomingKg = 0;
          newStatus = 'PARTIAL';
        }

        // Update pending_deliveries row
        await trx('pending_deliveries')
          .where('id', delivery.id)
          .update({
            pending_qty: newPendingQty,
            fulfilled_qty: newFulfilledQty,
            status: newStatus,
            updated_at: new Date(),
          });

        const deliveryActualCost = Math.round(qtyToDeliver * purchase_cost_per_kg * 100) / 100;

        // True Cost Correction: Update actual_cogs on original sales invoice item
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
                // True Cost Correction: Overwrite estimated_cogs with actual_cogs to perfectly reconcile profit reports
                updatePayload.estimated_cogs = updatedActualCogs;
                const soldKg = Number(invoiceItem.net_kg_processed || invoiceItem.quantity || 1);
                if (soldKg > 0) {
                  updatePayload.applied_cogs_per_kg = Math.round((updatedActualCogs / soldKg) * 10000) / 10000;
                }
              }
            } else {
              // Proportional partial fulfillment update
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

        // Audit transaction for stock intercepted & delivered directly
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
          created_by: createdBy,
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

      // UPDATE products rolling stock and average cost
      await trx('products')
        .where('id', item.product_id)
        .update({
          total_stock_kg: newTotalStock,
          rolling_avg_cost_per_kg: newRollingAvg,
          cost_price: purchase_cost_per_kg,
          updated_at: new Date(),
        });

      // ── Dedicated Batch Creation Tied to Parent Purchase Invoice ──
      const roundedCostPerKg = Math.round(purchase_cost_per_kg * 100) / 100;
      const itemSize = (item.size && String(item.size).trim().length > 0)
        ? String(item.size).trim()
        : (productWithCat.size && String(productWithCat.size).trim().length > 0 ? String(productWithCat.size).trim() : 'Standard');
      const batchNum = `PB-${invoice.invoice_number || invoice.id.slice(0, 8)}-${item.product_id.slice(0, 4)}-${Date.now()}`;

      await trx('inventory_batches').insert({
        product_id: item.product_id,
        purchase_invoice_id: invoice.id,
        batch_number: batchNum,
        batch_buy_price_per_kg: roundedCostPerKg,
        original_qty: incoming_kg,
        remaining_qty: remainder_kg,
        status: remainder_kg > 0 ? 'ACTIVE' : 'DEPLETED',
        size: itemSize,
      });

      itemsToInsert.push({
        purchase_invoice_id: invoice.id,
        product_id: item.product_id,
        size: itemSize,
        quantity: quantity_kg,
        selected_unit: item.selected_unit || 'KG',
        actual_weight_per_unit: 1.0,
        net_kg_processed: incoming_kg,
        net_kg_added: remainder_kg,
        actual_weight_kg: incoming_kg,
        unit_price: price_per_kg,
        total_price: itemTotal,
      });
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
export async function processPurchaseReturn(
  input: {
    parent_invoice_id: string;
    items?: { product_id: string; return_quantity?: number; quantity?: number }[];
    line_items?: { product_id: string; return_quantity?: number; quantity?: number }[];
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
      .whereNot('pi.status', 'CANCELLED')
      .select('pii.product_id', trx.raw('SUM(ABS(pii.quantity)) as total_returned_qty'))
      .groupBy('pii.product_id');

    const returnMap = new Map<string, number>();
    for (const ret of existingDebitNotes) {
      returnMap.set(ret.product_id, Number(ret.total_returned_qty || 0));
    }

    const returnedItems = input.line_items || input.items || [];
    let totalDebitAmount = 0;
    const itemsToInsert: any[] = [];

    for (const itemInput of returnedItems) {
      const returnedQty = Number(itemInput.return_quantity ?? itemInput.quantity ?? 0);
      if (returnedQty <= 0) continue;

      const parentItem = parentItems.find((p) => p.product_id === itemInput.product_id);
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
      const newStatus = newRemaining <= 0 ? 'DEPLETED' : batch.status;

      await trx('inventory_batches')
        .where('id', batch.id)
        .update({
          remaining_qty: newRemaining,
          original_qty: newOriginal,
          status: newStatus,
          updated_at: new Date(),
        });

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

    // Insert new row into purchase_invoices with invoice_type = 'DEBIT_NOTE'
    const [debitNote] = await trx('purchase_invoices')
      .insert({
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
      })
      .returning('*');

    const finalItems = itemsToInsert.map((item) => ({
      ...item,
      purchase_invoice_id: debitNote.id,
    }));

    await trx('purchase_invoice_items').insert(finalItems);

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
    .whereNot('pi.status', 'CANCELLED')
    .select('pii.product_id', db.raw('SUM(ABS(pii.quantity)) as total_returned_qty'))
    .groupBy('pii.product_id');

  const returnMap = new Map<string, number>();
  for (const ret of existingDebitNotes) {
    returnMap.set(ret.product_id, Number(ret.total_returned_qty || 0));
  }

  const items = await Promise.all(
    parentItems.map(async (item: any) => {
      const originalQty = Math.abs(Number(item.quantity || 0));
      const previouslyReturned = returnMap.get(item.product_id) || 0;
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
        product_id: item.product_id,
        product_name: item.product_name,
        product_code: item.product_code,
        product_size: item.product_size,
        selected_unit: item.selected_unit || 'KG',
        unit_price: Number(item.unit_price || 0),
        original_quantity: originalQty,
        previously_returned: previouslyReturned,
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

export async function updatePurchaseInvoiceStatus(id: string, updateData: { status?: string; paid_amount?: number }) {
  const [updated] = await db('purchase_invoices')
    .where({ id })
    .update({ ...updateData, updated_at: new Date() })
    .returning('*');
  return updated;
}
