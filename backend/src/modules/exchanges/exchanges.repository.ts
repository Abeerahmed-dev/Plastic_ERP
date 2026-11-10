import type { Knex } from 'knex';
import db from '../../db/knex';
import { CreateExchangeInput, ExchangeQuery } from './exchanges.schemas';
import { NotFoundError, ValidationError, InsufficientStockError } from '../../shared/errors';
import { restoreInventoryBucketsLifo } from '../invoices/invoices.repository';

export interface ProductExchangeRow {
  id: string;
  exchange_number: string;
  exchange_date: string;
  given_product_id: string;
  given_quantity: number;
  given_unit_cost: number;
  received_product_id: string;
  received_quantity: number;
  received_unit_cost: number;
  notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  given_product_name?: string;
  given_product_code?: string;
  given_product_size?: string;
  received_product_name?: string;
  received_product_code?: string;
  received_product_size?: string;
  created_by_name?: string;
  invoice_id?: string;
  invoice_number?: string;
  returned_item?: any;
  new_item?: any;
  financial_bridge?: any;
}

export async function generateNextExchangeNumber(trx: Knex.Transaction | Knex = db): Promise<string> {
  const rows = await trx('product_exchanges')
    .where('exchange_number', 'like', 'EXCH-%')
    .select('exchange_number');

  let maxNum = 0;
  for (const r of rows) {
    if (r.exchange_number) {
      const numPart = r.exchange_number.replace('EXCH-', '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `EXCH-${(maxNum + 1).toString().padStart(5, '0')}`;
}

/**
 * Main Exchange Transaction Entrypoint.
 * Automatically branches between:
 * 1. Invoice Line Item Exchange (Strict Proportional Return + FIFO Outflow + Financial Bridge)
 * 2. Standalone Inventory Exchange (Warehouse Product-to-Product Swap)
 */
export async function createExchangeTransaction(
  payload: CreateExchangeInput,
  userId?: string,
): Promise<ProductExchangeRow> {
  return await db.transaction(async (trx) => {
    const isInvoiceExchange = Boolean(
      payload.sales_invoice_item_id || payload.original_item_id || payload.invoice_id,
    );

    if (isInvoiceExchange) {
      return await executeInvoiceExchange(trx, payload, userId);
    }

    return await executeStandaloneExchange(trx, payload, userId);
  });
}

/**
 * ── INVOICE-BASED PRODUCT EXCHANGE: STRICT "RETURN + RE-SALE" TRANSACTION ──
 * Phase 1: Proportional Return with LIFO / Lineage COGS reversal & Warehouse asset restoration.
 * Phase 2: FIFO Outflow Depletion with Real-time Locked Actual COGS on new invoice line item.
 * Phase 3: Total Recalculation & True Net Math Financial Bridge (Wallet Advance Surplus or Balance Due Deficit).
 */
async function executeInvoiceExchange(
  trx: Knex.Transaction,
  payload: CreateExchangeInput,
  userId?: string,
): Promise<ProductExchangeRow> {
  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 1: THE PROPORTIONAL RETURN (LIFO INFLOW)
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Identify the original sales_invoice_items row being exchanged
  let originalItem: any;
  const salesInvoiceItemId = payload.sales_invoice_item_id || payload.original_item_id;

  if (salesInvoiceItemId) {
    originalItem = await trx('sales_invoice_items')
      .where({ id: salesInvoiceItemId })
      .forUpdate()
      .first();
  } else if (payload.invoice_id) {
    const retProdId = payload.received_product_id;
    if (retProdId) {
      originalItem = await trx('sales_invoice_items')
        .where({ invoice_id: payload.invoice_id, product_id: retProdId })
        .forUpdate()
        .first();
    }
  }

  if (!originalItem) {
    throw new NotFoundError(`Sales invoice line item for exchange`);
  }

  // Fetch and lock parent invoice
  const parentInvoice = await trx('sales_invoices')
    .where({ id: originalItem.invoice_id })
    .forUpdate()
    .first();

  if (!parentInvoice) {
    throw new NotFoundError(`Parent sales invoice for item ${originalItem.id}`);
  }

  if (parentInvoice.status === 'CANCELLED') {
    throw new ValidationError('Cannot process an exchange on a cancelled invoice.');
  }

  if (parentInvoice.invoice_type === 'CREDIT_NOTE') {
    throw new ValidationError('Cannot process an exchange against a Credit Note.');
  }

  const originalQty = Math.abs(Number(originalItem.quantity || 0));
  if (originalQty <= 0) {
    throw new ValidationError('Original line item has zero or negative quantity.');
  }

  const returnedQty = Number(
    payload.returned_quantity ?? payload.returned_qty ?? payload.received_quantity ?? 0,
  );

  if (returnedQty <= 0) {
    throw new ValidationError('Returned quantity must be greater than zero.');
  }

  if (returnedQty > originalQty + 0.0001) {
    throw new ValidationError(
      `Returned quantity (${returnedQty}) exceeds original billed quantity (${originalQty}).`,
    );
  }

  // 2. Calculate the exact proportion of the exchange (e.g. 50 KG / 100 KG = 0.50)
  const proportion = Math.min(1.0, returnedQty / originalQty);

  // 3. Deduct returned_qty from the original invoice line item
  const newOriginalQty = Math.round((originalQty - returnedQty) * 10000) / 10000;
  const unitPrice = Number(originalItem.unit_price || 0);
  const unitMultiplier = Number(originalItem.actual_weight_per_unit || 1.0);
  const newTotalPrice = Math.round(newOriginalQty * unitPrice * 100) / 100;
  const newNetKg = Math.round(newOriginalQty * unitMultiplier * 10000) / 10000;

  const originalActualCogs = Number(originalItem.actual_cogs || 0);
  const originalEstimatedCogs = Number(originalItem.estimated_cogs || 0);

  // Proportionally reverse original COGS
  const reversedActualCogs = Math.round(originalActualCogs * proportion * 100) / 100;
  const reversedEstimatedCogs = Math.round(originalEstimatedCogs * proportion * 100) / 100;

  const newActualCogs = Math.max(0, Math.round((originalActualCogs - reversedActualCogs) * 100) / 100);
  const newEstimatedCogs = Math.max(
    0,
    Math.round((originalEstimatedCogs - reversedEstimatedCogs) * 100) / 100,
  );

  await trx('sales_invoice_items')
    .where({ id: originalItem.id })
    .update({
      quantity: newOriginalQty,
      net_kg_processed: newNetKg,
      total_price: newTotalPrice,
      actual_cogs: newActualCogs,
      estimated_cogs: newEstimatedCogs,
      updated_at: new Date(),
    });

  // 4. Pass returned_qty directly into restoreInventoryBucketsLifo to restore physical stock & purchase buckets
  const returnedKg = returnedQty * unitMultiplier;

  // Restore physical stock in products table
  await trx('products')
    .where({ id: originalItem.product_id })
    .update({
      total_stock_kg: trx.raw('total_stock_kg + ?', [returnedKg]),
      updated_at: new Date(),
    });

  // Route directly through restoreInventoryBucketsLifo:
  // Finds original PB-PUR- bucket that fulfilled this sale and restores its remaining_qty
  const { totalRestoredCogs } = await restoreInventoryBucketsLifo(
    trx,
    originalItem.id,
    returnedKg,
    {
      productId: originalItem.product_id,
      batchId: originalItem.batch_id,
    },
  );

  // If sales_invoice_item_batches junction table exists, reduce qty_deducted on originalItem
  const hasJunctionTable = await trx.schema.hasTable('sales_invoice_item_batches');
  if (hasJunctionTable) {
    let remToDeduct = returnedKg;
    const lineageRecords = await trx('sales_invoice_item_batches')
      .where('sales_invoice_item_id', originalItem.id)
      .orderBy('cogs_per_kg', 'desc')
      .orderBy('created_at', 'desc');

    for (const lRec of lineageRecords) {
      if (remToDeduct <= 0) break;
      const curDeducted = Number(lRec.qty_deducted || 0);
      const take = Math.min(remToDeduct, curDeducted);
      await trx('sales_invoice_item_batches')
        .where({ id: lRec.id })
        .update({
          qty_deducted: Math.max(0, curDeducted - take),
          updated_at: new Date(),
        });
      remToDeduct -= take;
    }
  }

  // Restore inventory asset value in warehouse ledger
  const assetValueRestored = reversedActualCogs > 0 ? reversedActualCogs : totalRestoredCogs;
  const restoredUnitCost = returnedKg > 0 ? assetValueRestored / returnedKg : 0;

  await trx('inventory_transactions').insert({
    product_id: originalItem.product_id,
    transaction_type: 'RETURN',
    quantity_kg: returnedKg,
    unit_cost: Math.round(restoredUnitCost * 10000) / 10000,
    total_asset_value: Math.round(assetValueRestored * 100) / 100,
    capital_equity_value: 0,
    notes: `Product Exchange Return against Invoice ${parentInvoice.invoice_number}`,
    created_by: userId || null,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 2: THE FIFO OUTFLOW & THE OUT-OF-STOCK GUARD
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Identify and validate new product requested for exchange
  const newProductId = payload.new_product_id || payload.given_product_id;
  if (!newProductId) {
    throw new ValidationError('Replacement outgoing product ID is required.');
  }

  const newQty = Number(payload.new_quantity ?? payload.given_quantity ?? 0);
  if (newQty <= 0) {
    throw new ValidationError('Replacement outgoing quantity must be greater than zero.');
  }

  const newProduct = await trx('products')
    .where({ id: newProductId })
    .forUpdate()
    .first();

  if (!newProduct) {
    throw new NotFoundError(`Replacement product with ID ${newProductId}`);
  }

  if (!newProduct.is_active) {
    throw new ValidationError(`Replacement product "${newProduct.name}" is deactivated.`);
  }

  const newCategory = await trx('categories').where({ id: newProduct.category_id }).first();
  const bagWeight = Number(newCategory?.bag_weight_kg || 25.0);
  const newSelectedUnit = payload.selected_unit || 'KG';
  const newUnitMultiplier =
    newSelectedUnit.toLowerCase() === 'bag' || newSelectedUnit.toLowerCase() === 'bora'
      ? bagWeight
      : 1.0;
  const newRequiredKg = newQty * newUnitMultiplier;

  const newSize = (payload.size || newProduct.size || 'Standard').trim();

  // 2. SEARCH DATABASE FOR EXISTING ACTIVE PB-PUR- BUCKETS
  const activeBuckets = await trx('inventory_batches')
    .where('product_id', newProductId)
    .andWhere('remaining_qty', '>', 0)
    .whereNotIn('status', ['DEPLETED', 'EXHAUSTED', 'CANCELLED'])
    .orderBy('created_at', 'asc'); // Strict FIFO: Oldest first

  const totalActiveBatchQty = activeBuckets.reduce(
    (sum, b) => sum + Number(b.remaining_qty || 0),
    0,
  );

  // ── THE OUT-OF-STOCK GUARD ──
  // If the FIFO engine cannot find any active stock on the shelves to fulfill the exchange,
  // it must either throw an OUT_OF_STOCK error or route the shortfall into pending_deliveries.
  // It CANNOT conjure free Rs. 0.00 stock!
  if (totalActiveBatchQty <= 0) {
    throw new InsufficientStockError(
      0,
      `OUT_OF_STOCK: No active inventory purchase buckets (PB-PUR-) found on shelves for "${newProduct.name}". Cannot exchange goods with Rs. 0.00 COGS.`,
    );
  }

  const availableBatchQty = Math.min(totalActiveBatchQty, newRequiredKg);
  const missingQty = Math.max(0, newRequiredKg - availableBatchQty);
  const isDeferred = missingQty > 0;

  if (missingQty > 0 && !payload.allow_backorder) {
    throw new InsufficientStockError(
      availableBatchQty,
      `OUT_OF_STOCK: Insufficient active inventory batch stock for "${newProduct.name}". Available on shelves: ${availableBatchQty} KG, Requested: ${newRequiredKg} KG. Cannot conjure free Rs. 0.00 stock.`,
    );
  }

  // 3. STRICT FIFO DEPLETION WHILE LOOP
  let kgToDeduct = availableBatchQty;
  let totalDepletedCogs = 0;
  let primaryBatchId: string | null = null;
  const itemBatchDepletions: {
    batch_id: string;
    qty_deducted: number;
    cogs_per_kg: number;
  }[] = [];

  for (const bucket of activeBuckets) {
    if (kgToDeduct <= 0) break;
    if (!primaryBatchId) primaryBatchId = bucket.id;

    const available = Number(bucket.remaining_qty || 0);
    const buyPrice = Number(bucket.batch_buy_price_per_kg ?? bucket.buy_price_per_kg ?? 0);

    if (buyPrice <= 0) {
      throw new ValidationError(
        `Active batch ${bucket.batch_number} has an invalid Rs. 0.00 cost basis. Cannot assign zero COGS.`,
      );
    }

    if (available >= kgToDeduct) {
      const qtyToTake = kgToDeduct;
      const newRemaining = available - qtyToTake;
      const newStatus = newRemaining <= 0 ? 'DEPLETED' : 'ACTIVE';

      await trx('inventory_batches')
        .where('id', bucket.id)
        .update({
          remaining_qty: newRemaining,
          status: newStatus,
          updated_at: new Date(),
        });

      totalDepletedCogs += qtyToTake * buyPrice;
      itemBatchDepletions.push({
        batch_id: bucket.id,
        qty_deducted: qtyToTake,
        cogs_per_kg: buyPrice,
      });
      kgToDeduct = 0;
      break;
    } else {
      const qtyToTake = available;
      await trx('inventory_batches')
        .where('id', bucket.id)
        .update({
          remaining_qty: 0,
          status: 'DEPLETED',
          updated_at: new Date(),
        });

      totalDepletedCogs += qtyToTake * buyPrice;
      itemBatchDepletions.push({
        batch_id: bucket.id,
        qty_deducted: qtyToTake,
        cogs_per_kg: buyPrice,
      });
      kgToDeduct -= qtyToTake;
    }
  }

  // Deduct physically available stock from product
  await trx('products')
    .where({ id: newProductId })
    .update({
      total_stock_kg: trx.raw('GREATEST(0, total_stock_kg - ?)', [availableBatchQty]),
      updated_at: new Date(),
    });

  // Record inventory transaction for physical dispatch
  const unitDispatchedCost = availableBatchQty > 0 ? totalDepletedCogs / availableBatchQty : 0;
  await trx('inventory_transactions').insert({
    product_id: newProductId,
    transaction_type: 'SALE',
    quantity_kg: availableBatchQty,
    unit_cost: Math.round(unitDispatchedCost * 10000) / 10000,
    total_asset_value: Math.round(totalDepletedCogs * 100) / 100,
    capital_equity_value: 0,
    notes: `Product Exchange Re-Sale against Invoice ${parentInvoice.invoice_number}${isDeferred ? ` (Dispatched ${availableBatchQty} KG, Deferred ${missingQty} KG)` : ''}`,
    created_by: userId || null,
  });

  // Calculate estimated COGS for any missing shortfall
  let lastPurchasePrice = 0;
  if (missingQty > 0) {
    const lastPurchaseItem = await trx('purchase_invoice_items as pii')
      .join('purchase_invoices as pi', 'pii.purchase_invoice_id', 'pi.id')
      .where('pii.product_id', newProductId)
      .whereNot('pi.status', 'CANCELLED')
      .orderBy('pi.date', 'desc')
      .orderBy('pii.created_at', 'desc')
      .select('pii.unit_price')
      .first();

    lastPurchasePrice = Number(
      lastPurchaseItem?.unit_price ||
      newProduct.rolling_avg_cost_per_kg ||
      newProduct.cost_price ||
      0,
    );
  }

  const missingEstimatedCogs = Math.round(missingQty * lastPurchasePrice * 100) / 100;
  const estimatedCogs = Math.round((totalDepletedCogs + missingEstimatedCogs) * 100) / 100;
  const lockedActualCogs = Math.round(totalDepletedCogs * 100) / 100;

  if (availableBatchQty > 0 && lockedActualCogs <= 0) {
    throw new ValidationError(
      'Cost valuation error: Outgoing exchanged goods cannot be assigned Rs. 0.00 COGS.',
    );
  }

  const appliedCogsPerKg =
    newRequiredKg > 0
      ? Math.round((estimatedCogs / newRequiredKg) * 10000) / 10000
      : lastPurchasePrice || Number(newProduct.cost_price || 0);

  const newUnitPrice =
    payload.new_unit_price !== undefined
      ? Number(payload.new_unit_price)
      : Number(newProduct.sale_price || newProduct.cost_price || 0);

  const newLineTotalPrice = Math.round(newQty * newUnitPrice * 100) / 100;

  // Insert as new row in sales_invoice_items linked to the same parent invoice
  const [insertedNewItem] = await trx('sales_invoice_items')
    .insert({
      invoice_id: parentInvoice.id,
      product_id: newProductId,
      size: newSize,
      batch_id: primaryBatchId,
      quantity: newQty,
      selected_unit: newSelectedUnit,
      actual_weight_per_unit: newUnitMultiplier,
      net_kg_processed: newRequiredKg,
      applied_cogs_per_kg: appliedCogsPerKg,
      unit_price: newUnitPrice,
      total_price: newLineTotalPrice,
      is_deferred: isDeferred,
      estimated_cogs: estimatedCogs,
      actual_cogs: lockedActualCogs,
      name_urdu: newProduct.name_urdu || null,
    })
    .returning('*');

  // Strict Batch Lineage
  if (hasJunctionTable && itemBatchDepletions.length > 0) {
    const lineageRows = itemBatchDepletions.map((dep) => ({
      sales_invoice_item_id: insertedNewItem.id,
      inventory_batch_id: dep.batch_id,
      qty_deducted: dep.qty_deducted,
      cogs_per_kg: dep.cogs_per_kg,
    }));
    await trx('sales_invoice_item_batches').insert(lineageRows);
  }

  // If shortfall exists, route into pending_deliveries backorder queue
  if (missingQty > 0) {
    await trx('pending_deliveries').insert({
      sales_invoice_id: parentInvoice.id,
      sales_invoice_item_id: insertedNewItem.id,
      product_id: newProductId,
      variant_id: null,
      pending_qty: missingQty,
      fulfilled_qty: 0,
      status: 'PENDING',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 3: TOTAL RECALCULATION & THE FINANCIAL BRIDGE (TRUE NET MATH)
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Recalculate parent sales_invoices.total_amount by summing updated line items
  const allCurrentItems = await trx('sales_invoice_items').where({
    invoice_id: parentInvoice.id,
  });

  const recalculatedSubtotal =
    Math.round(
      allCurrentItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0) * 100,
    ) / 100;

  const discount = Number(parentInvoice.discount || 0);
  const deliveryCharge = Number(parentInvoice.delivery_charge || 0);
  const recalculatedTotalAmount =
    Math.round((Math.max(0, recalculatedSubtotal - discount) + deliveryCharge) * 100) / 100;

  const previousTotalAmount = Number(parentInvoice.total_amount || 0);
  const currentPaidAmount = Number(parentInvoice.paid_amount || 0);

  let finalPaidAmount = currentPaidAmount;
  let surplusCash = 0;

  // 2. The Financial Bridge:
  // - If the new goods are cheaper, the surplus cash routes to customer's WALLET_ADVANCE.
  // - If the new goods are more expensive, the invoice Balance Due increases.
  // - Allow the existing payment allocation engine to handle any cash deficits or surpluses automatically.
  if (recalculatedTotalAmount < currentPaidAmount) {
    surplusCash = Math.round((currentPaidAmount - recalculatedTotalAmount) * 100) / 100;
    finalPaidAmount = recalculatedTotalAmount;

    // Free up surplus allocation from payment_allocations to convert back into customer WALLET_ADVANCE
    const hasAllocations = await trx.schema.hasTable('payment_allocations');
    if (hasAllocations) {
      let remSurplus = surplusCash;
      const allocations = await trx('payment_allocations')
        .where('invoice_id', parentInvoice.id)
        .orderBy('allocated_amount', 'desc');

      for (const alloc of allocations) {
        if (remSurplus <= 0) break;
        const curAlloc = Number(alloc.allocated_amount || 0);
        const reduceBy = Math.min(remSurplus, curAlloc);
        const newAlloc = Math.round((curAlloc - reduceBy) * 100) / 100;

        if (newAlloc <= 0) {
          await trx('payment_allocations').where({ id: alloc.id }).delete();
        } else {
          await trx('payment_allocations')
            .where({ id: alloc.id })
            .update({ allocated_amount: newAlloc });
        }
        remSurplus = Math.round((remSurplus - reduceBy) * 100) / 100;
      }
    }
  } else if (recalculatedTotalAmount > currentPaidAmount) {
    // New goods are more expensive: check if customer has available unallocated advance in wallet
    const remainingDeficit = Math.round((recalculatedTotalAmount - currentPaidAmount) * 100) / 100;
    const hasAllocations = await trx.schema.hasTable('payment_allocations');

    if (hasAllocations && remainingDeficit > 0) {
      const customerPayments = await trx('customer_payments')
        .where('customer_id', parentInvoice.customer_id)
        .whereNotIn('cheque_status', ['BOUNCED', 'FAILED'])
        .where((qb) => {
          qb.whereNull('payment_method').orWhereNot('payment_method', 'WALLET_ADVANCE');
        })
        .orderBy('payment_date', 'asc')
        .orderBy('created_at', 'asc');

      let toCover = remainingDeficit;
      for (const pmt of customerPayments) {
        if (toCover <= 0) break;
        const pmtAmount = Number(pmt.amount || 0);
        const [allocSum] = await trx('payment_allocations')
          .where('payment_id', pmt.id)
          .sum('allocated_amount as total_allocated');
        const allocated = Number(allocSum?.total_allocated || 0);
        const unallocated = Math.round((pmtAmount - allocated) * 100) / 100;

        if (unallocated > 0) {
          const coverAmt = Math.min(toCover, unallocated);
          await trx('payment_allocations').insert({
            payment_id: pmt.id,
            invoice_id: parentInvoice.id,
            allocated_amount: coverAmt,
          });
          finalPaidAmount = Math.round((finalPaidAmount + coverAmt) * 100) / 100;
          toCover = Math.round((toCover - coverAmt) * 100) / 100;
        }
      }
    }
  }

  const newStatus =
    parentInvoice.status === 'CANCELLED'
      ? 'CANCELLED'
      : finalPaidAmount >= recalculatedTotalAmount
        ? 'PAID'
        : finalPaidAmount > 0
          ? 'PARTIAL'
          : 'UNPAID';

  await trx('sales_invoices')
    .where({ id: parentInvoice.id })
    .update({
      subtotal: recalculatedSubtotal,
      total_amount: recalculatedTotalAmount,
      paid_amount: finalPaidAmount,
      status: newStatus,
      updated_at: new Date(),
    });

  // 4. Generate exchange reference number and store audit record in product_exchanges
  // NOTE: A retail exchange must NEVER create a new warehouse batch! (No PB-EXCH- batches)
  const exchangeNumber = await generateNextExchangeNumber(trx);
  const originalProduct = await trx('products').where({ id: originalItem.product_id }).first();

  const [insertedExchange] = await trx('product_exchanges')
    .insert({
      exchange_number: exchangeNumber,
      exchange_date: payload.exchange_date ? new Date(payload.exchange_date) : new Date(),
      given_product_id: newProductId,
      given_quantity: newQty,
      given_unit_cost: appliedCogsPerKg,
      received_product_id: originalItem.product_id,
      received_quantity: returnedQty,
      received_unit_cost: Math.round(restoredUnitCost * 10000) / 10000,
      notes: payload.notes || `Product Exchange against Invoice ${parentInvoice.invoice_number}`,
      status: 'COMPLETED',
      created_by: userId || null,
    })
    .returning('*');

  return {
    ...insertedExchange,
    given_quantity: Number(insertedExchange.given_quantity),
    given_unit_cost: Number(insertedExchange.given_unit_cost),
    received_quantity: Number(insertedExchange.received_quantity),
    received_unit_cost: Number(insertedExchange.received_unit_cost),
    given_product_name: newProduct.name,
    given_product_code: newProduct.code,
    given_product_size: newSize,
    received_product_name: originalProduct?.name,
    received_product_code: originalProduct?.code,
    received_product_size: originalItem.size,
    invoice_id: parentInvoice.id,
    invoice_number: parentInvoice.invoice_number,
    returned_item: {
      sales_invoice_item_id: originalItem.id,
      product_id: originalItem.product_id,
      returned_quantity: returnedQty,
      proportion,
      reversed_cogs: reversedActualCogs,
      remaining_quantity: newOriginalQty,
      remaining_actual_cogs: newActualCogs,
    },
    new_item: {
      sales_invoice_item_id: insertedNewItem.id,
      product_id: newProductId,
      quantity: newQty,
      unit_price: newUnitPrice,
      total_price: newLineTotalPrice,
      actual_cogs: lockedActualCogs,
      applied_cogs_per_kg: appliedCogsPerKg,
      is_deferred: isDeferred,
    },
    financial_bridge: {
      previous_total: previousTotalAmount,
      new_total: recalculatedTotalAmount,
      paid_amount: finalPaidAmount,
      balance_due: Math.round((recalculatedTotalAmount - finalPaidAmount) * 100) / 100,
      surplus_to_wallet_advance: surplusCash,
      status: newStatus,
    },
  };
}

/**
 * ── STANDALONE INVENTORY EXCHANGE (WAREHOUSE PRODUCT SWAP) ──
 * Calculates the exact FIFO cost of the outgoing goods, and mathematically transfers
 * that total asset value into a newly minted PB-EXCH- batch for the incoming product.
 *
 * Phase 1: Deplete Outgoing Stock & Calculate Cost (FIFO Outflow)
 * Phase 2: Transfer Cost to Incoming Stock (Mint PB-EXCH- Batch Inflow)
 * Phase 3: Record Audit Trail (inventory_transactions & product_exchanges)
 */
async function executeStandaloneExchange(
  trx: Knex.Transaction,
  payload: CreateExchangeInput,
  userId?: string,
): Promise<ProductExchangeRow> {
  const givenProductId = payload.given_product_id!;
  const receivedProductId = payload.received_product_id!;
  const givenQuantity = Number(payload.given_quantity || 0);
  const receivedQuantity = Number(payload.received_quantity || 0);

  if (givenProductId === receivedProductId) {
    throw new ValidationError('Cannot exchange a product for itself.');
  }

  if (givenQuantity <= 0 || receivedQuantity <= 0) {
    throw new ValidationError('Given and received quantities must be greater than zero.');
  }

  // Deadlock Prevention: lock product rows in consistent ID order
  const [firstId, secondId] = [givenProductId, receivedProductId].sort();
  await trx('products').where({ id: firstId }).forUpdate();
  await trx('products').where({ id: secondId }).forUpdate();

  const givenProduct = await trx('products').where({ id: givenProductId }).first();
  if (!givenProduct) {
    throw new NotFoundError(`Outgoing product with ID ${givenProductId}`);
  }

  const receivedProduct = await trx('products').where({ id: receivedProductId }).first();
  if (!receivedProduct) {
    throw new NotFoundError(`Incoming product with ID ${receivedProductId}`);
  }

  if (!givenProduct.is_active) {
    throw new ValidationError(
      `Outgoing product "${givenProduct.name}" is deactivated and cannot be exchanged.`,
    );
  }

  if (!receivedProduct.is_active) {
    throw new ValidationError(
      `Incoming product "${receivedProduct.name}" is deactivated and cannot be exchanged.`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 1: DEPLETE OUTGOING STOCK & CALCULATE COST (FIFO DEPLETION LOOP)
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Query active inventory_batches for the outgoing_product_id ordered by created_at ASC
  const activeBuckets = await trx('inventory_batches')
    .where('product_id', givenProductId)
    .andWhere('remaining_qty', '>', 0)
    .whereNotIn('status', ['DEPLETED', 'EXHAUSTED', 'CANCELLED'])
    .orderBy('created_at', 'asc'); // Strict FIFO: Oldest first

  const totalActiveGivenStock = activeBuckets.reduce(
    (sum, b) => sum + Number(b.remaining_qty || 0),
    0,
  );

  // The Out-of-Stock Guard
  if (totalActiveGivenStock < givenQuantity) {
    throw new InsufficientStockError(
      totalActiveGivenStock,
      `OUT_OF_STOCK: Insufficient active inventory batch stock for "${givenProduct.name}". Available: ${totalActiveGivenStock} KG, Requested: ${givenQuantity} KG. Cannot conjure free stock.`,
    );
  }

  // 2. FIFO while (qtyToFulfill > 0) loop to deduct outgoing_quantity
  // As we deduct from each batch, accumulate the monetary value:
  // total_depleted_cost += (qty_taken * batch.buy_price_per_kg)
  let qtyToFulfill = givenQuantity;
  let totalDepletedCost = 0;

  for (const bucket of activeBuckets) {
    if (qtyToFulfill <= 0) break;
    const available = Number(bucket.remaining_qty || 0);
    const buyPrice = Number(bucket.batch_buy_price_per_kg ?? bucket.buy_price_per_kg ?? 0);

    if (buyPrice <= 0) {
      throw new ValidationError(
        `Active batch ${bucket.batch_number} has an invalid Rs. 0.00 cost basis. Cannot assign zero cost.`,
      );
    }

    const qtyTaken = Math.min(qtyToFulfill, available);
    const newRemaining = Math.round((available - qtyTaken) * 10000) / 10000;

    await trx('inventory_batches')
      .where('id', bucket.id)
      .update({
        remaining_qty: newRemaining,
        status: newRemaining <= 0 ? 'DEPLETED' : 'ACTIVE',
        updated_at: new Date(),
      });

    totalDepletedCost += qtyTaken * buyPrice;
    qtyToFulfill -= qtyTaken;
  }

  const givenUnitCost =
    givenQuantity > 0
      ? Math.round((totalDepletedCost / givenQuantity) * 10000) / 10000
      : 0;

  // 3. Decrement the products.total_stock_kg for the outgoing product
  await trx('products')
    .where({ id: givenProductId })
    .update({
      total_stock_kg: trx.raw('GREATEST(0, total_stock_kg - ?)', [givenQuantity]),
      updated_at: new Date(),
    });

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 2: TRANSFER COST TO INCOMING STOCK & MINT NEW PB-EXCH- BATCH
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Calculate the new unit cost for incoming goods:
  // const new_unit_cost = total_depleted_cost / incoming_quantity
  const newUnitCost =
    receivedQuantity > 0
      ? Math.round((totalDepletedCost / receivedQuantity) * 10000) / 10000
      : 0;
  const batchBuyPrice = Math.round(newUnitCost * 100) / 100;

  // Generate Exchange Reference Number
  const exchangeNumber = await generateNextExchangeNumber(trx);

  // 2. Insert a single new row into inventory_batches with PB-EXCH- prefix
  const incomingBatchNumber = `PB-EXCH-${exchangeNumber}-${Date.now().toString().slice(-6)}`;
  const incomingSize = (receivedProduct.size && String(receivedProduct.size).trim().length > 0)
    ? String(receivedProduct.size).trim()
    : 'Standard';

  await trx('inventory_batches').insert({
    product_id: receivedProductId,
    batch_number: incomingBatchNumber,
    batch_buy_price_per_kg: batchBuyPrice,
    original_qty: receivedQuantity,
    remaining_qty: receivedQuantity,
    status: 'ACTIVE',
    size: incomingSize,
  });

  // 3. Increment the products.total_stock_kg for the incoming product
  const currentIncomingStock = Number(receivedProduct.total_stock_kg || 0);
  const currentIncomingAvgCost = Number(receivedProduct.rolling_avg_cost_per_kg || receivedProduct.cost_price || 0);
  const currentTotalVal = currentIncomingStock * currentIncomingAvgCost;
  const newTotalIncomingStock = currentIncomingStock + receivedQuantity;
  const newIncomingRollingAvg = newTotalIncomingStock > 0
    ? Math.round(((currentTotalVal + totalDepletedCost) / newTotalIncomingStock) * 10000) / 10000
    : newUnitCost;

  await trx('products')
    .where({ id: receivedProductId })
    .update({
      total_stock_kg: trx.raw('total_stock_kg + ?', [receivedQuantity]),
      rolling_avg_cost_per_kg: newIncomingRollingAvg,
      cost_price: batchBuyPrice,
      updated_at: new Date(),
    });

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 3: RECORD THE AUDIT TRAIL
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Outgoing stock deduction ledger entry
  await trx('inventory_transactions').insert({
    product_id: givenProductId,
    transaction_type: 'ADJUSTMENT',
    quantity_kg: givenQuantity,
    unit_cost: givenUnitCost,
    total_asset_value: Math.round(totalDepletedCost * 100) / 100,
    capital_equity_value: 0,
    notes: `Product Exchange ${exchangeNumber}: Dispatched ${givenQuantity} KG of ${givenProduct.name} (exchanged for ${receivedQuantity} KG of ${receivedProduct.name})`,
    created_by: userId || null,
  });

  // 2. Incoming stock addition ledger entry (Exact transferred monetary value)
  await trx('inventory_transactions').insert({
    product_id: receivedProductId,
    transaction_type: 'ADJUSTMENT',
    quantity_kg: receivedQuantity,
    unit_cost: newUnitCost,
    total_asset_value: Math.round(totalDepletedCost * 100) / 100,
    capital_equity_value: 0,
    notes: `Product Exchange ${exchangeNumber}: Received ${receivedQuantity} KG of ${receivedProduct.name} in batch ${incomingBatchNumber} (cost transferred: Rs. ${Math.round(totalDepletedCost * 100) / 100})`,
    created_by: userId || null,
  });

  // 3. Insert record into product_exchanges table linking outgoing, incoming, and transferred monetary value
  const [inserted] = await trx('product_exchanges')
    .insert({
      exchange_number: exchangeNumber,
      exchange_date: payload.exchange_date ? new Date(payload.exchange_date) : new Date(),
      given_product_id: givenProductId,
      given_quantity: givenQuantity,
      given_unit_cost: givenUnitCost,
      received_product_id: receivedProductId,
      received_quantity: receivedQuantity,
      received_unit_cost: newUnitCost,
      notes: payload.notes || null,
      status: 'COMPLETED',
      created_by: userId || null,
    })
    .returning('*');

  return {
    ...inserted,
    given_quantity: Number(inserted.given_quantity),
    given_unit_cost: Number(inserted.given_unit_cost),
    received_quantity: Number(inserted.received_quantity),
    received_unit_cost: Number(inserted.received_unit_cost),
    given_product_name: givenProduct.name,
    given_product_code: givenProduct.code,
    given_product_size: givenProduct.size,
    received_product_name: receivedProduct.name,
    received_product_code: receivedProduct.code,
    received_product_size: receivedProduct.size,
  };
}

export async function findExchanges(query: ExchangeQuery): Promise<{
  rows: ProductExchangeRow[];
  total: number;
}> {
  const { page, limit, search, startDate, endDate } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('product_exchanges as pe')
    .leftJoin('products as gp', 'pe.given_product_id', 'gp.id')
    .leftJoin('products as rp', 'pe.received_product_id', 'rp.id')
    .leftJoin('users as u', 'pe.created_by', 'u.id')
    .modify((qb) => {
      if (search) {
        const term = `%${search}%`;
        qb.where((inner) => {
          inner
            .whereILike('pe.exchange_number', term)
            .orWhereILike('gp.name', term)
            .orWhereILike('gp.code', term)
            .orWhereILike('rp.name', term)
            .orWhereILike('rp.code', term)
            .orWhereILike('pe.notes', term);
        });
      }
      if (startDate) {
        qb.where('pe.exchange_date', '>=', new Date(startDate));
      }
      if (endDate) {
        qb.where('pe.exchange_date', '<=', new Date(endDate));
      }
    });

  const [{ count }] = await baseQuery.clone().count<[{ count: string }]>('pe.id as count');
  const total = parseInt(count, 10);

  const rows = await baseQuery
    .clone()
    .select(
      'pe.*',
      'gp.name as given_product_name',
      'gp.code as given_product_code',
      'gp.size as given_product_size',
      'rp.name as received_product_name',
      'rp.code as received_product_code',
      'rp.size as received_product_size',
      'u.name as created_by_name',
    )
    .orderBy('pe.exchange_date', 'desc')
    .orderBy('pe.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const mapped: ProductExchangeRow[] = rows.map((r: any) => ({
    ...r,
    given_quantity: Number(r.given_quantity || 0),
    given_unit_cost: Number(r.given_unit_cost || 0),
    received_quantity: Number(r.received_quantity || 0),
    received_unit_cost: Number(r.received_unit_cost || 0),
  }));

  return { rows: mapped, total };
}

export async function findExchangeById(id: string): Promise<ProductExchangeRow | undefined> {
  const row = await db('product_exchanges as pe')
    .leftJoin('products as gp', 'pe.given_product_id', 'gp.id')
    .leftJoin('products as rp', 'pe.received_product_id', 'rp.id')
    .leftJoin('users as u', 'pe.created_by', 'u.id')
    .where('pe.id', id)
    .select(
      'pe.*',
      'gp.name as given_product_name',
      'gp.code as given_product_code',
      'gp.size as given_product_size',
      'rp.name as received_product_name',
      'rp.code as received_product_code',
      'rp.size as received_product_size',
      'u.name as created_by_name',
    )
    .first();

  if (!row) return undefined;

  return {
    ...row,
    given_quantity: Number(row.given_quantity || 0),
    given_unit_cost: Number(row.given_unit_cost || 0),
    received_quantity: Number(row.received_quantity || 0),
    received_unit_cost: Number(row.received_unit_cost || 0),
  };
}
