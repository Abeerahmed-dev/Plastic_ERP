import db from '../../db/knex';
import { CreateInvoiceInput } from './invoices.schemas';

export interface InvoiceRow {
  id: string;
  customer_id: string;
  invoice_number: string;
  date: Date;
  due_date: Date | null;
  subtotal: number;
  discount: number;
  delivery_charge: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function generateNextInvoiceNumber(): Promise<string> {
  const rows = await db('sales_invoices')
    .where('invoice_number', 'like', 'INV-%')
    .select('invoice_number');

  let maxNum = 0;
  for (const r of rows) {
    if (r.invoice_number && !r.invoice_number.startsWith('POS-')) {
      const numPart = r.invoice_number.replace('INV-', '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `INV-${(maxNum + 1).toString().padStart(5, '0')}`;
}

export async function createInvoiceWithItems(
  input: CreateInvoiceInput,
  invoiceNumber: string,
  userId?: string
): Promise<string> {
  return await db.transaction(async (trx) => {
    // Force truncation to 2 decimal places before inserting into sales_invoice_items
    const sanitizedItems = (input.items || []).map((item: any) => {
      const quantity = Number(item.quantity) || 0;
      const unit_price = Math.round(Number(item.unit_price) * 100) / 100;
      const total_price = item.total_price !== undefined || item.total !== undefined
        ? Math.round(Number(item.total_price ?? item.total) * 100) / 100
        : Math.round(quantity * unit_price * 100) / 100;

      return {
        ...item,
        quantity,
        unit_price,
        total_price,
      };
    });

    let subtotal = 0;
    const itemsToInsert = [];

    for (const item of sanitizedItems) {
      const total_price = item.total_price;
      subtotal += total_price;

      const selected_unit = (item as any).selected_unit || 'KG';

      const product = await trx('products as p')
        .join('categories as c', 'p.category_id', 'c.id')
        .where('p.id', item.product_id)
        .select(
          'p.id',
          'p.name',
          'p.name_urdu',
          'p.size',
          'p.total_stock_kg',
          'p.rolling_avg_cost_per_kg',
          'p.min_markup_percent',
          'c.bag_weight_kg'
        )
        .first();

      if (!product) {
        throw new Error(`Product ${item.product_id} not found.`);
      }

      const itemSize = (item.size && String(item.size).trim().length > 0)
        ? String(item.size).trim()
        : (product.size && String(product.size).trim().length > 0 ? String(product.size).trim() : '');

      if (!itemSize) {
        throw new Error('Size/Variant is compulsory');
      }

      const bagWeight = Number(product.bag_weight_kg || 25.0);
      const unitMultiplier = (selected_unit.toLowerCase() === 'bag' || selected_unit.toLowerCase() === 'bora')
        ? bagWeight
        : 1.0;

      const sold_kg = Number(item.quantity) * unitMultiplier;

      if (sold_kg < 0) {
        // ── RETURN LINE ITEM: Add Stock Back ──
        const abs_kg = Math.abs(sold_kg);
        const avgCost = Number(product.rolling_avg_cost_per_kg || 0);

        await trx('products')
          .where({ id: product.id })
          .update({
            total_stock_kg: trx.raw('total_stock_kg + ?', [abs_kg]),
            updated_at: new Date(),
          });

        itemsToInsert.push({
          product_id: item.product_id,
          variant_id: (item as any).variant_id || null,
          size: itemSize,
          batch_id: null,
          quantity: item.quantity,
          selected_unit,
          actual_weight_per_unit: unitMultiplier,
          net_kg_processed: sold_kg,
          applied_cogs_per_kg: avgCost,
          unit_price: item.unit_price,
          total_price,
          is_deferred: false,
          estimated_cogs: Math.round(abs_kg * avgCost * 100) / 100,
          actual_cogs: Math.round(abs_kg * avgCost * 100) / 100,
          missing_qty: 0,
          name_urdu: product.name_urdu || null,
        });


        // Record RETURN inventory transaction
        await trx('inventory_transactions').insert({
          product_id: item.product_id,
          transaction_type: 'RETURN',
          quantity_kg: abs_kg,
          unit_cost: avgCost,
          total_asset_value: Math.round(abs_kg * avgCost * 100) / 100,
          capital_equity_value: 0,
          notes: `Sales Return Invoice ${invoiceNumber}`,
          created_by: userId,
        });
      } else {
        // ── SALE LINE ITEM: Backorder Sales Engine & Deferred Fulfillment ──
        // Concurrency Safety Wall: Lock row and query live inventory bucket in real-time
        const liveProduct = await trx('products')
          .where({ id: item.product_id })
          .forUpdate()
          .select('id', 'name', 'total_stock_kg', 'rolling_avg_cost_per_kg', 'cost_price', 'min_markup_percent')
          .first();

        const live_stock = Math.max(0, Number(liveProduct?.total_stock_kg ?? product.total_stock_kg ?? 0));
        const requested_qty = sold_kg;
        const available_qty = Math.min(live_stock, requested_qty);
        const missing_qty = Math.max(0, requested_qty - available_qty);
        const is_deferred = missing_qty > 0;

        let kgToDeduct = available_qty;
        let totalAvailableCogs = 0;
        let primaryBatchId: string | null = null;

        if (available_qty > 0) {
          // ── Auto-FIFO Price-Bucket Stock Deduction for available stock ──
          const activeBuckets = await trx('inventory_batches')
            .where('product_id', item.product_id)
            .andWhere('remaining_qty', '>', 0)
            .orderBy('created_at', 'asc'); // Oldest first

          for (const bucket of activeBuckets) {
            if (kgToDeduct <= 0) break;
            if (!primaryBatchId) primaryBatchId = bucket.id;

            const available = Number(bucket.remaining_qty || 0);
            const buyPrice = Number(bucket.batch_buy_price_per_kg || 0);

            if (available >= kgToDeduct) {
              const newRemaining = available - kgToDeduct;
              const newStatus = newRemaining <= 0 ? 'DEPLETED' : 'ACTIVE';

              await trx('inventory_batches')
                .where('id', bucket.id)
                .update({
                  remaining_qty: newRemaining,
                  status: newStatus,
                  updated_at: new Date(),
                });

              totalAvailableCogs += kgToDeduct * buyPrice;
              kgToDeduct = 0;
              break;
            } else {
              // Empty this bucket to 0
              await trx('inventory_batches')
                .where('id', bucket.id)
                .update({
                  remaining_qty: 0,
                  status: 'DEPLETED',
                  updated_at: new Date(),
                });

              totalAvailableCogs += available * buyPrice;
              kgToDeduct -= available;
            }
          }

          // Deduct physically available stock from product
          await trx('products')
            .where({ id: product.id })
            .update({
              total_stock_kg: trx.raw('total_stock_kg - ?', [available_qty]),
              updated_at: new Date(),
            });

          // Record inventory transaction for physical dispatch
          await trx('inventory_transactions').insert({
            product_id: item.product_id,
            transaction_type: 'SALE',
            quantity_kg: available_qty,
            unit_cost: available_qty > 0 ? (totalAvailableCogs / available_qty) : 0,
            total_asset_value: Math.round(totalAvailableCogs * 100) / 100,
            capital_equity_value: 0,
            notes: `Sales Invoice ${invoiceNumber} (Dispatched ${available_qty} KG${missing_qty > 0 ? `, Deferred ${missing_qty} KG` : ''})`,
            created_by: userId,
          });
        }

        // ── Fetch Last Known Purchase Price for Estimated COGS ──
        let lastPurchasePrice = 0;
        if (missing_qty > 0) {
          const lastPurchaseItem = await trx('purchase_invoice_items as pii')
            .join('purchase_invoices as pi', 'pii.purchase_invoice_id', 'pi.id')
            .where('pii.product_id', item.product_id)
            .whereNot('pi.status', 'CANCELLED')
            .orderBy('pi.date', 'desc')
            .orderBy('pii.created_at', 'desc')
            .select('pii.unit_price')
            .first();

          if (lastPurchaseItem && Number(lastPurchaseItem.unit_price) > 0) {
            lastPurchasePrice = Number(lastPurchaseItem.unit_price);
          } else {
            lastPurchasePrice = Number(product.rolling_avg_cost_per_kg || product.cost_price || 0);
          }
        }

        const missingEstimatedCogs = Math.round(missing_qty * lastPurchasePrice * 100) / 100;
        const estimated_cogs = Math.round((totalAvailableCogs + missingEstimatedCogs) * 100) / 100;
        const actual_cogs = Math.round(totalAvailableCogs * 100) / 100;

        const appliedCogsPerKg = sold_kg > 0
          ? Math.round((estimated_cogs / sold_kg) * 10000) / 10000
          : (lastPurchasePrice || Number(product.rolling_avg_cost_per_kg || 0));

        // Price Floor Check against rolling average cost / estimated cost
        const minMarkupPercent = Number(product.min_markup_percent ?? 5.00);
        const floorPricePerKg = appliedCogsPerKg * (1 + (minMarkupPercent / 100));
        const sellingPricePerKg = sold_kg > 0 ? (total_price / sold_kg) : Number(item.unit_price);

        if (floorPricePerKg > 0 && sellingPricePerKg < floorPricePerKg - 0.01) {
          throw new Error(`Selling price for ${product.name} is below minimum authorized margin.`);
        }

        itemsToInsert.push({
          product_id: item.product_id,
          variant_id: (item as any).variant_id || null,
          size: itemSize,
          batch_id: primaryBatchId,
          quantity: item.quantity,
          selected_unit,
          actual_weight_per_unit: unitMultiplier,
          net_kg_processed: sold_kg,
          applied_cogs_per_kg: appliedCogsPerKg,
          unit_price: item.unit_price,
          total_price,
          is_deferred,
          estimated_cogs,
          actual_cogs,
          missing_qty,
          name_urdu: product.name_urdu || null,
        });
      }
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const discount = Math.round(Number(input.discount || 0) * 100) / 100;
    const deliveryCharge = Math.round(Number((input as any).delivery_charge || 0) * 100) / 100;
    const total_amount = Math.round((Math.max(0, subtotal - discount) + deliveryCharge) * 100) / 100;

    // ── Credit Limit Check ──
    const customer = await trx('customers').where({ id: input.customer_id }).first();
    if (customer && Number(customer.credit_limit || 0) > 0) {
      const balanceDue = total_amount - Number((input as any).paid_amount || 0);
      if (balanceDue > 0) {
        const existingSum = await trx('sales_invoices')
          .where({ customer_id: customer.id })
          .select(trx.raw('SUM(total_amount - paid_amount) as total_unpaid'))
          .first();

        const currentUnpaid = Number(existingSum?.total_unpaid || 0);
        const openingBal = Number(customer.opening_balance || 0);
        const newTotalPending = openingBal + currentUnpaid + balanceDue;

        if (newTotalPending > Number(customer.credit_limit)) {
          throw new Error("Credit limit exceeded. Owner approval required.");
        }
      }
    }

    const advanceApplied = Math.round(Number((input as any).advance_applied_amount || 0) * 100) / 100;
    const directPaid = Math.round(Number((input as any).paid_amount || (input as any).amount_paid || 0) * 100) / 100;
    const initialPaidAmount = Math.round((directPaid + advanceApplied) * 100) / 100;
    const invoiceStatus = initialPaidAmount >= total_amount ? 'PAID' : (initialPaidAmount > 0 ? 'PARTIAL' : 'UNPAID');

    // Insert Invoice (Financial Lock: Total amount locked in at full selling price)
    const [invoice] = await trx('sales_invoices')
      .insert({
        customer_id: input.customer_id,
        invoice_number: invoiceNumber,
        invoice_type: 'SALE',
        date: input.date,
        due_date: input.due_date || null,
        subtotal,
        discount,
        delivery_charge: deliveryCharge,
        total_amount,
        paid_amount: initialPaidAmount,
        status: invoiceStatus,
        notes: input.notes,
        created_by: userId,
      })
      .returning('*');

    const invoiceId = invoice.id;

    // Insert Items with invoice_id into sales_invoice_items
    const finalItems = itemsToInsert.map(item => ({
      invoice_id: invoiceId,
      product_id: item.product_id,
      size: item.size || 'Standard',
      batch_id: item.batch_id,
      quantity: item.quantity,
      selected_unit: item.selected_unit,
      actual_weight_per_unit: item.actual_weight_per_unit,
      net_kg_processed: item.net_kg_processed,
      applied_cogs_per_kg: item.applied_cogs_per_kg,
      unit_price: item.unit_price,
      total_price: item.total_price,
      is_deferred: item.is_deferred,
      estimated_cogs: item.estimated_cogs,
      actual_cogs: item.actual_cogs,
      name_urdu: item.name_urdu || null,
    }));


    const insertedDbItems = await trx('sales_invoice_items')
      .insert(finalItems)
      .returning('*');

    // Insert shortfall (missing_qty) into pending_deliveries queue
    for (let i = 0; i < itemsToInsert.length; i++) {
      const itemMeta = itemsToInsert[i];
      if (itemMeta.missing_qty > 0) {
        const insertedItem = insertedDbItems[i];
        await trx('pending_deliveries').insert({
          sales_invoice_id: invoiceId,
          sales_invoice_item_id: insertedItem.id,
          product_id: itemMeta.product_id,
          variant_id: itemMeta.variant_id || null,
          pending_qty: itemMeta.missing_qty,
          fulfilled_qty: 0,
          status: 'PENDING',
        });
      }
    }

    // Record direct customer payment if directPaid > 0
    if (directPaid > 0) {
      const [pmt] = await trx('customer_payments').insert({
        customer_id: input.customer_id,
        invoice_id: invoiceId,
        payment_number: `RCV-${invoiceNumber}`,
        payment_date: input.date || new Date().toISOString().split('T')[0],
        amount: directPaid,
        payment_method: (input as any).payment_method || 'CASH',
        bank_account_id: (input as any).bank_account_id || null,
        notes: `Payment for Invoice ${invoiceNumber}`,
        created_by: userId,
      }).returning('*');

      await trx('payment_allocations').insert({
        payment_id: pmt.id,
        invoice_id: invoiceId,
        allocated_amount: directPaid,
      });
    }

    // Record Virtual Payment from Advance Wallet if advanceApplied > 0
    if (advanceApplied > 0) {
      const rows = await trx('customer_payments')
        .where('payment_number', 'like', 'RCV-%')
        .select('payment_number');

      let maxNum = 0;
      for (const r of rows) {
        if (r.payment_number && !r.payment_number.startsWith('RCV-POS-')) {
          const numPart = r.payment_number.replace('RCV-', '');
          const num = parseInt(numPart, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
      const paymentNumber = `RCV-${(maxNum + 1).toString().padStart(5, '0')}`;

      const [virtualPayment] = await trx('customer_payments').insert({
        customer_id: input.customer_id,
        invoice_id: invoiceId,
        payment_number: paymentNumber,
        payment_date: input.date || new Date().toISOString().split('T')[0],
        amount: advanceApplied,
        payment_method: 'WALLET_ADVANCE',
        cheque_status: 'CLEARED',
        notes: 'Manually applied from advance balance',
        created_by: userId,
      }).returning('*');

      await trx('payment_allocations').insert({
        payment_id: virtualPayment.id,
        invoice_id: invoiceId,
        allocated_amount: advanceApplied,
      });
    }

    return invoiceId;
  });
}

export async function generateNextCreditNoteNumber(trx?: any): Promise<string> {
  const query = trx ? trx('sales_invoices') : db('sales_invoices');
  const rows = await query
    .where('invoice_number', 'like', 'CN-%')
    .select('invoice_number');

  let maxNum = 0;
  for (const r of rows) {
    if (r.invoice_number) {
      const numPart = r.invoice_number.replace('CN-', '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `CN-${(maxNum + 1).toString().padStart(5, '0')}`;
}

export async function getInvoiceReturnSummary(parentInvoiceId: string) {
  const parentInvoice = await db('sales_invoices').where('id', parentInvoiceId).first();
  if (!parentInvoice) {
    throw new Error('Parent sales invoice not found.');
  }

  const parentItems = await db('sales_invoice_items as sii')
    .join('products as p', 'sii.product_id', 'p.id')
    .where('sii.invoice_id', parentInvoiceId)
    .select(
      'sii.id',
      'sii.product_id',
      'sii.quantity',
      'sii.selected_unit',
      'sii.actual_weight_per_unit',
      'sii.net_kg_processed',
      'sii.unit_price',
      'sii.total_price',
      'p.name as product_name',
      'p.code as product_code',
      'p.size as product_size'
    );

  // Find all previous returns against this parent invoice
  const existingReturns = await db('sales_invoices as si')
    .join('sales_invoice_items as sii', 'si.id', 'sii.invoice_id')
    .where('si.parent_invoice_id', parentInvoiceId)
    .select(
      'sii.product_id',
      db.raw('SUM(ABS(sii.quantity)) as total_returned_qty'),
      db.raw('SUM(ABS(sii.net_kg_processed)) as total_returned_kg')
    )
    .groupBy('sii.product_id');

  const returnMap = new Map<string, { returned_qty: number; returned_kg: number }>();
  for (const ret of existingReturns) {
    returnMap.set(ret.product_id, {
      returned_qty: Number(ret.total_returned_qty || 0),
      returned_kg: Number(ret.total_returned_kg || 0),
    });
  }

  const itemsWithReturnStatus = parentItems.map((item) => {
    const prev = returnMap.get(item.product_id) || { returned_qty: 0, returned_kg: 0 };
    const originalQty = Math.abs(Number(item.quantity || 0));
    const returnedQty = prev.returned_qty;
    const remainingQty = Math.max(0, originalQty - returnedQty);

    return {
      ...item,
      original_quantity: originalQty,
      previously_returned_quantity: returnedQty,
      remaining_quantity: remainingQty,
    };
  });

  return {
    parentInvoice,
    items: itemsWithReturnStatus,
  };
}

function ensureTxAdapter(tx: any) {
  if (tx && tx.inventory_batch && typeof tx.inventory_batch.update === 'function') {
    return tx;
  }
  const knexClient = (tx && typeof tx === 'function') || (tx && tx.raw) ? tx : db;
  return {
    ...tx,
    inventory_batch: {
      fields: {
        original_qty: 'original_qty',
        remaining_qty: 'remaining_qty',
      },
      findMany: async ({ where, orderBy }: any = {}) => {
        let q = knexClient('inventory_batches');
        if (where?.product_id) {
          q = q.where('product_id', where.product_id);
        }
        if (where?.remaining_qty?.lt !== undefined) {
          q = q.whereRaw('remaining_qty < original_qty');
        }
        if (orderBy) {
          if (Array.isArray(orderBy)) {
            for (const ob of orderBy) {
              const [col, dir] = Object.entries(ob)[0];
              q = q.orderBy(col, dir);
            }
          } else {
            const [col, dir] = Object.entries(orderBy)[0];
            q = q.orderBy(col, dir);
          }
        }
        return await q;
      },
      update: async ({ where, data }: any = {}) => {
        let q = knexClient('inventory_batches');
        if (where?.id) {
          q = q.where('id', where.id);
        }
        const results = await q.update({
          ...data,
          updated_at: new Date(),
        }).returning('*');
        return results && results[0] ? results[0] : results;
      },
    },
  };
}

/**
 * Strict LIFO Restoration Loop
 * Iterates through eligible buckets newest first, applies capacity capping,
 * flips depleted buckets to ACTIVE, updates the database sequentially inside the transaction,
 * and cascades unallocated overflow to the newest bucket.
 */
export async function restoreInventoryBucketsLifo(
  arg1: any,
  arg2: any,
  arg3?: any
): Promise<{ totalRestoredCogs: number; remainingUnallocated: number; primaryBatchId: string | null }> {
  let rawTx: any;
  let returnedProductId: string | undefined;
  let returnedQuantity: number = 0;
  let eligibleBuckets: any[] | undefined;

  if (typeof arg1 === 'string') {
    returnedProductId = arg1;
    returnedQuantity = Number(arg2 || 0);
    rawTx = arg3;
  } else if (Array.isArray(arg1)) {
    eligibleBuckets = arg1;
    returnedQuantity = Number(arg2 || 0);
    rawTx = arg3;
  } else if (typeof arg2 === 'string') {
    rawTx = arg1;
    returnedProductId = arg2;
    returnedQuantity = Number(arg3 || 0);
  } else if (Array.isArray(arg2)) {
    rawTx = arg1;
    eligibleBuckets = arg2;
    returnedQuantity = Number(arg3 || 0);
  } else {
    rawTx = arg1;
    returnedQuantity = Number(arg2 || 0);
  }

  const tx = ensureTxAdapter(rawTx);

  if (!eligibleBuckets && returnedProductId) {
    eligibleBuckets = await tx.inventory_batch.findMany({
      where: {
        product_id: returnedProductId,
        remaining_qty: { lt: tx.inventory_batch.fields.original_qty },
      },
      orderBy: { created_date: 'desc' }, // CRITICAL: LIFO order
    });
  }

  eligibleBuckets = eligibleBuckets || [];

  let qtyToRestore = Number(returnedQuantity);
  let totalRestoredCogs = 0;
  let primaryBatchId: string | null = null;
  const updatedRemainingMap = new Map<string, number>();

  for (const bucket of eligibleBuckets) {
    if (qtyToRestore <= 0) break;
    if (!primaryBatchId) primaryBatchId = bucket.id;

    const original = Number(bucket.original_qty);
    const remaining = Number(bucket.remaining_qty);
    const spaceAvailable = original - remaining;

    if (spaceAvailable <= 0) continue;

    const restoreAmount = Math.min(qtyToRestore, spaceAvailable);
    qtyToRestore -= restoreAmount;
    totalRestoredCogs += (restoreAmount * Number(bucket.buy_price_per_kg ?? bucket.batch_buy_price_per_kg ?? 0));

    const newRemaining = remaining + restoreAmount;
    const newStatus = newRemaining > 0 ? 'ACTIVE' : bucket.status;

    updatedRemainingMap.set(bucket.id, newRemaining);

    // CRITICAL MISSING STEP: Actually update the database
    await tx.inventory_batch.update({
      where: { id: bucket.id },
      data: {
        remaining_qty: newRemaining,
        status: newStatus,
      },
    });
  }

  // Handle Unallocated Overflow
  if (qtyToRestore > 0) {
    /* Force update the very first eligible bucket with the overflow */
    let targetBucket = eligibleBuckets[0];
    if (!targetBucket && returnedProductId) {
      const allBuckets = await tx.inventory_batch.findMany({
        where: { product_id: returnedProductId },
        orderBy: { created_date: 'desc' },
      });
      targetBucket = allBuckets[0];
    }

    if (targetBucket) {
      if (!primaryBatchId) primaryBatchId = targetBucket.id;
      const currentRem = updatedRemainingMap.get(targetBucket.id) ?? Number(targetBucket.remaining_qty);
      const overflowRemaining = currentRem + qtyToRestore;
      const buyPrice = Number(targetBucket.buy_price_per_kg ?? targetBucket.batch_buy_price_per_kg ?? 0);
      totalRestoredCogs += (qtyToRestore * buyPrice);

      await tx.inventory_batch.update({
        where: { id: targetBucket.id },
        data: {
          remaining_qty: overflowRemaining,
          status: 'ACTIVE',
        },
      });
      qtyToRestore = 0;
    }
  }

  return { totalRestoredCogs, remainingUnallocated: qtyToRestore, primaryBatchId };
}

export async function processSalesReturn(
  parentInvoiceId: string,
  input: { return_reason: string; items: { product_id: string; return_quantity: number }[] },
  userId?: string
) {
  return await db.transaction(async (trx) => {
    const parentInvoice = await trx('sales_invoices').where('id', parentInvoiceId).first();
    if (!parentInvoice) {
      throw new Error('Parent sales invoice not found.');
    }
    if (parentInvoice.invoice_type === 'CREDIT_NOTE') {
      throw new Error('Cannot process return against a Credit Note.');
    }

    const parentItems = await trx('sales_invoice_items as sii')
      .join('products as p', 'sii.product_id', 'p.id')
      .where('sii.invoice_id', parentInvoiceId)
      .select('sii.*', 'p.name as product_name', 'p.rolling_avg_cost_per_kg');

    const existingReturns = await trx('sales_invoices as si')
      .join('sales_invoice_items as sii', 'si.id', 'sii.invoice_id')
      .where('si.parent_invoice_id', parentInvoiceId)
      .select('sii.product_id', trx.raw('SUM(ABS(sii.quantity)) as total_returned_qty'))
      .groupBy('sii.product_id');

    const returnMap = new Map<string, number>();
    for (const ret of existingReturns) {
      returnMap.set(ret.product_id, Number(ret.total_returned_qty || 0));
    }

    let totalCreditAmount = 0;
    const itemsToInsert: any[] = [];

    for (const itemInput of input.items) {
      if (itemInput.return_quantity <= 0) continue;

      const parentItem = parentItems.find((p) => p.product_id === itemInput.product_id);
      if (!parentItem) {
        throw new Error(`Product ${itemInput.product_id} was not billed on the parent invoice.`);
      }

      const originalQty = Math.abs(Number(parentItem.quantity || 0));
      const previouslyReturned = returnMap.get(itemInput.product_id) || 0;
      const remainingQty = originalQty - previouslyReturned;

      if (itemInput.return_quantity > remainingQty + 0.0001) {
        throw new Error(
          `Return quantity for ${parentItem.product_name} exceeds remaining returnable quantity (Requested: ${itemInput.return_quantity}, Available: ${remainingQty}).`
        );
      }

      const unitMultiplier = Number(parentItem.actual_weight_per_unit || 1.0);
      const returnKg = itemInput.return_quantity * unitMultiplier;
      const unitPrice = Math.round(Number(parentItem.unit_price || 0) * 100) / 100;
      const lineTotal = Math.round((itemInput.return_quantity * unitPrice) * 100) / 100;

      totalCreditAmount = Math.round((totalCreditAmount + lineTotal) * 100) / 100;

      // Restock the product in inventory total
      await trx('products')
        .where({ id: itemInput.product_id })
        .update({
          total_stock_kg: trx.raw('total_stock_kg + ?', [returnKg]),
          updated_at: new Date(),
        });

      // ── LIFO Restoration Loop (Sales Return / Credit Note) ──
      const { totalRestoredCogs, primaryBatchId } = await restoreInventoryBucketsLifo(
        trx,
        itemInput.product_id,
        returnKg
      );

      // Unit COGS strictly derived from the restored buckets sum (NOT rolling WAC)
      const restoredUnitCost = returnKg > 0
        ? Math.round((totalRestoredCogs / returnKg) * 10000) / 10000
        : 0;

      // Record RETURN inventory transaction with exact restored COGS
      await trx('inventory_transactions').insert({
        product_id: itemInput.product_id,
        transaction_type: 'RETURN',
        quantity_kg: returnKg,
        unit_cost: restoredUnitCost,
        total_asset_value: Math.round(totalRestoredCogs * 100) / 100,
        capital_equity_value: 0,
        notes: `Sales Return Credit Note (Parent: ${parentInvoice.invoice_number}) - Reason: ${input.return_reason}`,
        created_by: userId,
      });

      itemsToInsert.push({
        product_id: itemInput.product_id,
        size: parentItem.size || 'Standard',
        batch_id: primaryBatchId,
        quantity: -Math.abs(itemInput.return_quantity),
        selected_unit: parentItem.selected_unit || 'KG',
        actual_weight_per_unit: unitMultiplier,
        net_kg_processed: -Math.abs(returnKg),
        applied_cogs_per_kg: restoredUnitCost,
        unit_price: unitPrice,
        total_price: -Math.abs(lineTotal),
      });

    }

    if (itemsToInsert.length === 0) {
      throw new Error('At least one item must have a return quantity greater than 0.');
    }

    const creditNoteNumber = await generateNextCreditNoteNumber(trx);

    // Insert Credit Note Invoice (paid_amount = 0 creates store credit balance for customer)
    const [creditNote] = await trx('sales_invoices')
      .insert({
        customer_id: parentInvoice.customer_id,
        invoice_number: creditNoteNumber,
        parent_invoice_id: parentInvoiceId,
        invoice_type: 'CREDIT_NOTE',
        return_reason: input.return_reason,
        date: new Date().toISOString().split('T')[0],
        due_date: null,
        subtotal: -Math.round(Math.abs(totalCreditAmount) * 100) / 100,
        discount: 0,
        total_amount: -Math.round(Math.abs(totalCreditAmount) * 100) / 100,
        paid_amount: 0,
        status: 'UNPAID',
        notes: `Credit Note against ${parentInvoice.invoice_number} — Reason: ${input.return_reason}`,
        created_by: userId,
      })
      .returning('*');

    const finalItems = itemsToInsert.map((item) => ({
      ...item,
      invoice_id: creditNote.id,
    }));

    await trx('sales_invoice_items').insert(finalItems);

    return creditNote;
  });
}

export async function findAllInvoices(filter?: { created_by?: string; is_pos_only?: boolean }) {
  const query = db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .leftJoin('users as u', 'si.created_by', 'u.id')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .where(function() {
      this.whereNull('si.invoice_type')
        .orWhereNotIn('si.invoice_type', ['CREDIT_NOTE', 'DEBIT_NOTE', 'RETURN']);
    })
    .whereNull('si.parent_invoice_id');

  if (filter?.is_pos_only) {
    query.where('si.invoice_number', 'like', 'POS-%');
  } else if (filter?.created_by) {
    query.where('si.created_by', filter.created_by);
  }

  const rows = await query
    .select(
      'si.id',
      'si.invoice_number',
      'si.date',
      'si.due_date',
      'si.subtotal',
      'si.discount',
      'si.delivery_charge',
      'si.total_amount',
      'si.paid_amount',
      'si.status',
      'si.invoice_type',
      'si.parent_invoice_id',
      'si.return_reason',
      'si.created_by',
      'c.id as customer_id',
      'c.name as customer_name',
      'c.code as customer_code',
      'c.city as city',
      'c.city as customer_city',
      'u.name as created_by_name',
      'r.name as created_by_role'
    )
    .orderBy('si.date', 'desc')
    .orderBy('si.created_at', 'desc');

  const invoiceIds = rows.map((r: any) => r.id);
  const paymentsByInvoice = new Map<string, any[]>();
  const creditNotesByInvoice = new Map<string, any[]>();
  const creditNotesTotalByInvoice = new Map<string, number>();

  if (invoiceIds.length > 0) {
    const hasAllocationsTable = await db.schema.hasTable('payment_allocations');
    const allocatedPayments = hasAllocationsTable
      ? await db('payment_allocations as pa')
          .join('customer_payments as cp', 'pa.payment_id', 'cp.id')
          .whereIn('pa.invoice_id', invoiceIds)
          .select(
            'cp.id',
            'pa.invoice_id',
            'cp.payment_number',
            'cp.payment_date',
            'pa.allocated_amount as amount',
            'cp.payment_method',
            'cp.notes',
            'cp.cheque_number',
            'cp.created_at'
          )
          .orderBy('cp.payment_date', 'asc')
          .orderBy('cp.created_at', 'asc')
      : [];

    const directPayments = await db('customer_payments')
      .whereIn('invoice_id', invoiceIds)
      .select(
        'id',
        'invoice_id',
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
      const key = `${p.invoice_id}_${p.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const list = paymentsByInvoice.get(p.invoice_id) || [];
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
        paymentsByInvoice.set(p.invoice_id, list);
      }
    }

    for (const p of directPayments) {
      const key = `${p.invoice_id}_${p.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const list = paymentsByInvoice.get(p.invoice_id) || [];
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
        paymentsByInvoice.set(p.invoice_id, list);
      }
    }

    // Eagerly load child returns (Credit Notes) linked to parent sales invoices
    const linkedCreditNotes = await db('sales_invoices as si')
      .whereIn('si.parent_invoice_id', invoiceIds)
      .where(function() {
        this.where('si.invoice_type', 'CREDIT_NOTE')
          .orWhere('si.invoice_type', 'RETURN')
          .orWhere('si.invoice_number', 'like', 'CN-%');
      })
      .whereNot('si.status', 'CANCELLED')
      .select('si.*')
      .orderBy('si.created_at', 'asc');

    for (const cn of linkedCreditNotes) {
      const pid = cn.parent_invoice_id;
      if (!pid) continue;
      const list = creditNotesByInvoice.get(pid) || [];
      list.push(cn);
      creditNotesByInvoice.set(pid, list);
      const curSum = creditNotesTotalByInvoice.get(pid) || 0;
      creditNotesTotalByInvoice.set(pid, curSum + Math.abs(Number(cn.total_amount || 0)));
    }
  }

  return rows.map((r) => {
    const original_total = Number(r.total_amount || 0);
    const returned_total = creditNotesTotalByInvoice.get(r.id) || 0;
    const net_invoice_total = Math.round((original_total - returned_total) * 100) / 100;
    const amount_paid = Number(r.paid_amount || r.amount_paid || 0);
    // CRITICAL: True net balance without Math.max(0, ...). Allow negative numbers for OVERPAID state.
    const balance_due = Math.round((net_invoice_total - amount_paid) * 100) / 100;
    const payments = paymentsByInvoice.get(r.id) || [];
    const credit_notes = creditNotesByInvoice.get(r.id) || [];

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
      customer_payments: payments,
      credit_notes,
      linked_credit_notes: credit_notes,
      created_by_name: r.created_by_name || 'System',
      created_by_role: r.created_by_role || 'ADMIN',
      creator: {
        name: r.created_by_name || 'System',
        role: r.created_by_role || 'ADMIN',
      },
    };
  });
}

export async function findInvoiceById(id: string) {
  const invoice = await db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .leftJoin('users as u', 'si.created_by', 'u.id')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .where('si.id', id)
    .select(
      'si.*',
      'c.name as customer_name',
      'c.code as customer_code',
      'c.phone as customer_phone',
      'c.city as customer_city',
      'u.name as created_by_name',
      'r.name as created_by_role'
    )
    .first();

  if (!invoice) return null;

  const original_total = Number(invoice.total_amount || 0);
  const amount_paid = Number(invoice.paid_amount || invoice.amount_paid || 0);

  // Fetch child credit notes if any exist against this parent invoice
  const creditNotesRows = await db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .where('si.parent_invoice_id', id)
    .where(function() {
      this.where('si.invoice_type', 'CREDIT_NOTE')
        .orWhere('si.invoice_type', 'RETURN')
        .orWhere('si.invoice_number', 'like', 'CN-%');
    })
    .whereNot('si.status', 'CANCELLED')
    .select(
      'si.*',
      'c.name as customer_name',
      'c.code as customer_code'
    )
    .orderBy('si.created_at', 'asc');

  const credit_notes = await Promise.all(
    creditNotesRows.map(async (cn) => {
      const cnItems = await db('sales_invoice_items as sii')
        .join('products as p', 'sii.product_id', 'p.id')
        .leftJoin('categories as c', 'p.category_id', 'c.id')
        .where('sii.invoice_id', cn.id)
        .select(
          'sii.*',
          'p.name as product_name',
          'p.name_urdu as product_name_urdu',
          'p.code as product_code',
          'p.size as product_size',
          'c.name as category'
        );
      return { ...cn, items: cnItems };
    })
  );

  const returned_total = (credit_notes || []).reduce(
    (sum: number, cn: any) => sum + Math.abs(Number(cn.total_amount || 0)),
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

  const hasAllocationsTable = await db.schema.hasTable('payment_allocations');
  const allocatedPayments = hasAllocationsTable
    ? await db('payment_allocations as pa')
        .join('customer_payments as cp', 'pa.payment_id', 'cp.id')
        .where('pa.invoice_id', id)
        .select(
          'cp.id',
          'pa.invoice_id',
          'cp.payment_number',
          'cp.payment_date',
          'pa.allocated_amount as amount',
          'cp.payment_method',
          'cp.bank_account_id',
          'cp.notes',
          'cp.cheque_number',
          'cp.created_at'
        )
        .orderBy('cp.payment_date', 'asc')
        .orderBy('cp.created_at', 'asc')
    : [];

  const directPayments = await db('customer_payments')
    .where('invoice_id', id)
    .select(
      'id',
      'invoice_id',
      'payment_number',
      'payment_date',
      'amount',
      'payment_method',
      'bank_account_id',
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
        bank_account_id: p.bank_account_id || null,
        reference_number: p.payment_number || p.cheque_number || p.notes || '',
        reference_notes: p.notes || '',
        notes: p.notes || '',
        cheque_number: p.cheque_number || null,
      });
    }
  }

  const cashPayments = payments.filter((p: any) => ['CASH', 'Cash', 'CASH_DRAWER'].includes(p.payment_method));
  const bankPayments = payments.filter((p: any) => ['BANK', 'BANK_TRANSFER', 'Bank Transfer', 'Online'].includes(p.payment_method));
  if (cashPayments.length > 0 && bankPayments.length > 0) {
    invoice.payment_method = 'SPLIT';
    invoice.split_cash_amount = cashPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    invoice.split_bank_amount = bankPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const bankP = bankPayments.find((p: any) => p.bank_account_id);
    if (bankP?.bank_account_id) {
      const bRow = await db('bank_accounts').where('id', bankP.bank_account_id).first();
      if (bRow) invoice.bank_name = bRow.bank_name;
    }
  }

  invoice.payments = payments;
  invoice.customer_payments = payments;

  invoice.creator = {
    name: invoice.created_by_name || 'System',
    role: invoice.created_by_role || 'ADMIN',
  };

  const items = await db('sales_invoice_items as sii')
    .join('products as p', 'sii.product_id', 'p.id')
    .leftJoin('categories as c', 'p.category_id', 'c.id')
    .where('sii.invoice_id', id)
    .select(
      'sii.*',
      'p.name as product_name',
      'p.name_urdu as product_name_urdu',
      'p.code as product_code',
      'p.size as product_size',
      'c.name as category'
    );

  const pending_deliveries = await db('pending_deliveries as pd')
    .join('products as p', 'pd.product_id', 'p.id')
    .where('pd.sales_invoice_id', id)
    .select(
      'pd.*',
      'p.name as product_name',
      'p.code as product_code'
    )
    .orderBy('pd.created_at', 'asc');

  return { ...invoice, items, credit_notes, pending_deliveries };
}

export async function getPendingDeliveries(query?: { status?: string; product_id?: string }) {
  let q = db('pending_deliveries as pd')
    .join('sales_invoices as si', 'pd.sales_invoice_id', 'si.id')
    .join('customers as c', 'si.customer_id', 'c.id')
    .join('products as p', 'pd.product_id', 'p.id')
    .select(
      'pd.*',
      'si.invoice_number',
      'si.date as invoice_date',
      'c.id as customer_id',
      'c.name as customer_name',
      'c.code as customer_code',
      'p.name as product_name',
      'p.code as product_code'
    )
    .orderBy('pd.created_at', 'asc');

  if (query?.status) {
    q = q.where('pd.status', query.status);
  } else {
    q = q.whereIn('pd.status', ['PENDING', 'PARTIAL']);
  }

  if (query?.product_id) {
    q = q.where('pd.product_id', query.product_id);
  }

  return await q;
}

