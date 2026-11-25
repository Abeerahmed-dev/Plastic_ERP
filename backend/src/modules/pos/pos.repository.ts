import db from '../../db/knex';
import { Knex } from 'knex';
import { WALKIN_CUSTOMER_PHONE } from '../../db/seeds/06_walkin_customer';
import { restoreInventoryBucketsLifo } from '../invoices/invoices.repository';

export { restoreInventoryBucketsLifo };

import { NotFoundError } from '../../shared/errors';
import { estimateOverdraftCogs, getLatestMarketBatchPrice } from '../../shared/overdraftPricing';

export async function processPOSCheckout(
  userId: string,
  items: { product_id: string; quantity: number; selected_unit?: string; unit_price?: number; price?: number }[],
  discount: number,
  _userRole?: string,
  customerId?: string,
  amountPaidInput?: number,
  paymentMethodInput?: string,
  bankAccountId?: string | null,
  splitCashAmountInput?: number,
  splitBankAmountInput?: number,
  deliveryChargesInput: number = 0,
  slipChargesInput: number = 2,
  options?: {
    offline_id?: string | null;
    offline_timestamp?: number | null;
  }
) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    if (options?.offline_id) {
      const existingInvoice = await trx('sales_invoices')
        .where({ offline_id: options.offline_id })
        .first();

      if (existingInvoice) {
        const existingItems = await trx('sales_invoice_items')
          .where({ invoice_id: existingInvoice.id });
        (existingInvoice as any).items = existingItems;
        (existingInvoice as any).idempotent_duplicate = true;
        return existingInvoice;
      }
    }

    const effectiveDiscount = Number(discount || 0);

    // 1. Customer Selection
    let targetCustomer = null;
    if (customerId) {
      targetCustomer = await trx('customers').where({ id: customerId }).first();
    }
    if (!targetCustomer) {
      targetCustomer = await trx('customers').where({ phone: WALKIN_CUSTOMER_PHONE }).first();
    }
    if (!targetCustomer) {
      targetCustomer = await trx('customers').whereILike('name', '%Walk-In%').first();
    }
    if (!targetCustomer) {
      const [newWalkIn] = await trx('customers')
        .insert({
          code: 'CUST-WALKIN',
          name: 'Walk-In Customer',
          phone: WALKIN_CUSTOMER_PHONE || '0000000000',
          customer_type: 'CASH',
          credit_limit: 0,
          opening_balance: 0,
        })
        .returning('*');
      targetCustomer = newWalkIn;
    }

    let subtotal = 0;
    const invoiceItemsToInsert = [];

    for (const item of items) {
      const selected_unit = item.selected_unit || 'KG';

      // Fetch Product & Category
      const product = await trx('products as p')
        .leftJoin('categories as c', 'p.category_id', 'c.id')
        .where('p.id', item.product_id)
        .select(
          'p.id',
          'p.name',
          'p.name_urdu',
          'p.total_stock_kg',
          'p.cost_price',
          'p.rolling_avg_cost_per_kg',
          'p.fixed_retail_price_per_kg',
          'p.sale_price',
          'p.min_markup_percent',
          'c.bag_weight_kg',
          'c.name as category'
        )
        .first();

      if (!product) {
        throw new NotFoundError(`Product ${item.product_id}`);
      }

      // Unit multiplier (default Bag wt if Bag selected, else 1 for KG)
      const bagWeight = Number(product.bag_weight_kg || 25.0);
      const unitMultiplier = (selected_unit.toLowerCase() === 'bag' || selected_unit.toLowerCase() === 'bora')
        ? bagWeight
        : 1.0;

      const retailNum = Number(product.fixed_retail_price_per_kg || 0);
      const saleNum = Number(product.sale_price || 0);
      const rawPrice = (item as any).price !== undefined ? (item as any).price : item.unit_price;
      const customPriceNum = rawPrice !== undefined && rawPrice !== null ? Number(rawPrice) : NaN;

      const defaultKgPrice = retailNum > 0 ? retailNum : (saleNum > 0 ? saleNum : 0);
      const defaultUnitPrice = defaultKgPrice * unitMultiplier;

      // Allow manual price override from payload; do not overwrite custom price with database product.selling_price
      const effectiveUnitPrice = !isNaN(customPriceNum) ? customPriceNum : defaultUnitPrice;
      if (effectiveUnitPrice < 0) {
        throw new Error(`Unit price for ${product.name} cannot be negative`);
      }
      const lineTotal = Number(item.quantity) * effectiveUnitPrice;
      subtotal += lineTotal;

      const isReturn = Number(item.quantity) < 0;

      if (isReturn) {
        const absQty = Math.abs(Number(item.quantity));
        const abs_kg = absQty * unitMultiplier;
        const sold_kg = -abs_kg; // negative quantity

        // ── LIFO Restoration Loop for POS Return ──
        const { totalRestoredCogs, primaryBatchId } = await restoreInventoryBucketsLifo(
          trx,
          item.product_id,
          abs_kg
        );

        const appliedCogsPerKg = abs_kg > 0
          ? Math.round((totalRestoredCogs / abs_kg) * 10000) / 10000
          : 0;
        const lineCogs = Math.round(totalRestoredCogs * 100) / 100;

        // Reverse inventory: Add stock back into product total
        await trx('products')
          .where({ id: product.id })
          .update({
            total_stock_kg: trx.raw('total_stock_kg + ?', [abs_kg]),
            updated_at: new Date(),
          });

        invoiceItemsToInsert.push({
          product_id: item.product_id,
          variant_id: (item as any).variant_id || null,
          size: (item as any).size || (product as any).size || 'Standard',
          batch_id: primaryBatchId,
          quantity: item.quantity,
          requested_qty: 0,
          fulfilled_qty: 0,
          deferred_qty: 0,
          selected_unit,
          actual_weight_per_unit: unitMultiplier,
          net_kg_processed: sold_kg,
          applied_cogs_per_kg: appliedCogsPerKg,
          unit_price: effectiveUnitPrice,
          total_price: lineTotal,
          is_deferred: false,
          estimated_cogs: -lineCogs,
          actual_cogs: -lineCogs,
          missing_qty: 0,
          name_urdu: product.name_urdu || null,
          batchDepletions: [],
        });

        // Record inventory transaction
        await trx('inventory_transactions').insert({
          product_id: item.product_id,
          transaction_type: 'RETURN',
          quantity_kg: abs_kg,
          unit_cost: appliedCogsPerKg,
          total_asset_value: lineCogs,
          capital_equity_value: 0,
          notes: `POS Return (${targetCustomer.name})`,
          created_by: userId,
        });
      } else {
        const sold_kg = Number(item.quantity) * unitMultiplier;

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
        const itemBatchDepletions: {
          batch_id: string;
          qty_deducted: number;
          cogs_per_kg: number;
        }[] = [];

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
            const buyPrice = Number(bucket.batch_buy_price_per_kg ?? bucket.buy_price_per_kg ?? 0);

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

              totalAvailableCogs += qtyToTake * buyPrice;
              itemBatchDepletions.push({
                batch_id: bucket.id,
                qty_deducted: qtyToTake,
                cogs_per_kg: buyPrice,
              });
              kgToDeduct = 0;
              break;
            } else {
              // Empty this bucket to 0
              const qtyToTake = available;
              await trx('inventory_batches')
                .where('id', bucket.id)
                .update({
                  remaining_qty: 0,
                  status: 'DEPLETED',
                  updated_at: new Date(),
                });

              totalAvailableCogs += qtyToTake * buyPrice;
              itemBatchDepletions.push({
                batch_id: bucket.id,
                qty_deducted: qtyToTake,
                cogs_per_kg: buyPrice,
              });
              kgToDeduct -= qtyToTake;
            }
          }

          // Fallback if physical stock was in total_stock_kg but not in active batches
          if (kgToDeduct > 0) {
            const { unitPrice: latestFallbackPrice } = await getLatestMarketBatchPrice(
              trx,
              item.product_id,
              liveProduct
            );
            totalAvailableCogs += kgToDeduct * latestFallbackPrice;
          }

          // Deduct physically available stock from product
          await trx('products')
            .where({ id: product.id })
            .update({
              total_stock_kg: trx.raw('GREATEST(0, total_stock_kg - ?)', [available_qty]),
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
            notes: `POS Sale (${targetCustomer.name}) (Dispatched ${available_qty} KG${missing_qty > 0 ? `, Deferred ${missing_qty} KG` : ''})`,
            created_by: userId,
          });
        }

        // ── Shared Overdraft Split Engine: latest market batch price (with product base/cost fallback) ──
        const { unitPrice: latestBatchPrice, estimatedCogs: missingEstimatedCogs } =
          await estimateOverdraftCogs(trx, item.product_id, missing_qty, liveProduct || product);

        const estimated_cogs = Math.round((totalAvailableCogs + missingEstimatedCogs) * 100) / 100;
        const actual_cogs = Math.round(totalAvailableCogs * 100) / 100;

        const appliedCogsPerKg = sold_kg > 0
          ? Math.round((estimated_cogs / sold_kg) * 10000) / 10000
          : (latestBatchPrice || Number(product.rolling_avg_cost_per_kg || product.cost_price || 0));

        invoiceItemsToInsert.push({
          product_id: item.product_id,
          variant_id: (item as any).variant_id || null,
          size: (item as any).size || product.size || 'Standard',
          batch_id: primaryBatchId,
          quantity: item.quantity,
          requested_qty,
          fulfilled_qty: available_qty,
          deferred_qty: missing_qty,
          selected_unit,
          actual_weight_per_unit: unitMultiplier,
          net_kg_processed: sold_kg,
          applied_cogs_per_kg: appliedCogsPerKg,
          unit_price: effectiveUnitPrice,
          total_price: lineTotal,
          is_deferred,
          estimated_cogs,
          actual_cogs,
          missing_qty,
          name_urdu: product.name_urdu || null,
          batchDepletions: itemBatchDepletions,
        });
      }
    }

    const deliveryCharges = Math.max(0, Math.round(Number(deliveryChargesInput || 0) * 100) / 100);
    const slipCharges = Math.max(0, Math.round(Number(slipChargesInput !== undefined ? slipChargesInput : 2) * 100) / 100);
    const totalAmount = Math.round((subtotal - effectiveDiscount + deliveryCharges + slipCharges) * 100) / 100;

    const isSplit = String(paymentMethodInput || '').toUpperCase() === 'SPLIT';
    const isBank = String(paymentMethodInput || '').toUpperCase() === 'BANK';
    const effectivePaymentMethod = isSplit ? 'SPLIT' : (isBank ? 'BANK' : 'CASH');

    let targetBankId: string | null = null;
    let targetBankName = '';
    if (isBank || isSplit) {
      if (bankAccountId) {
        targetBankId = bankAccountId;
      } else {
        const primaryBank = await trx('bank_accounts').where('is_active', true).orderBy('created_at', 'asc').first();
        targetBankId = primaryBank?.id || null;
      }
      if (targetBankId) {
        const bRow = await trx('bank_accounts').where('id', targetBankId).first();
        targetBankName = bRow?.bank_name || '';
      }
    }

    let cashTendered: number;
    let changeReturned = 0;
    let effectiveAmountPaid: number;
    let balanceDue: number;
    let splitCashNet = 0;
    let splitBankNet = 0;

    if (totalAmount <= 0) {
      effectiveAmountPaid = totalAmount;
      cashTendered = totalAmount;
      changeReturned = 0;
      balanceDue = 0;
    } else if (isSplit) {
      const splitCashTendered = Math.round(Number(splitCashAmountInput || 0) * 100) / 100;
      const splitBankPortion = Math.round(Number(splitBankAmountInput || 0) * 100) / 100;
      const totalTendered = Math.round((splitCashTendered + splitBankPortion) * 100) / 100;

      changeReturned = Math.max(0, Math.round((totalTendered - totalAmount) * 100) / 100);
      effectiveAmountPaid = Math.min(totalTendered, totalAmount);
      balanceDue = Math.max(0, Math.round((totalAmount - effectiveAmountPaid) * 100) / 100);

      // Any change return is returned from the cash tender
      splitCashNet = Math.max(0, Math.round((splitCashTendered - changeReturned) * 100) / 100);
      splitBankNet = splitBankPortion;
      cashTendered = splitCashTendered;
    } else {
      cashTendered = (amountPaidInput !== undefined && amountPaidInput !== null) ? Number(amountPaidInput) : totalAmount;
      changeReturned = Math.max(0, Math.round((cashTendered - totalAmount) * 100) / 100);
      effectiveAmountPaid = Math.min(cashTendered, totalAmount);
      balanceDue = Math.max(0, Math.round((totalAmount - effectiveAmountPaid) * 100) / 100);
    }

    const invoiceRequestedTotal = invoiceItemsToInsert.reduce((sum, it: any) => sum + Number(it.requested_qty || 0), 0);
    const invoiceFulfilledTotal = invoiceItemsToInsert.reduce((sum, it: any) => sum + Number(it.fulfilled_qty || 0), 0);
    const invoiceDeferredTotal = invoiceItemsToInsert.reduce((sum, it: any) => sum + Number(it.deferred_qty || 0), 0);

    // 2. Determine Next Sequential POS Bill Number
    await trx.raw('SELECT pg_advisory_xact_lock(90003)');
    const posRows = await trx('sales_invoices')
      .where('invoice_number', 'like', 'POS-%')
      .select('invoice_number');

    let maxBillNum = 0;
    for (const r of posRows) {
      if (!r.invoice_number) continue;
      const numPart = r.invoice_number.replace(/^POS-/i, '');
      const num = parseInt(numPart, 10);
      // Exclude legacy epoch timestamps like POS-17924... (> 1,000,000,000)
      if (!isNaN(num) && num < 1000000000 && num > maxBillNum) {
        maxBillNum = num;
      }
    }
    const nextBillNo = maxBillNum + 1;

    // 2. Create Sales Invoice
    const [invoice] = await trx('sales_invoices')
      .insert({
        customer_id: targetCustomer.id,
        invoice_number: `POS-${nextBillNo}`,
        invoice_type: 'SALE',
        date: new Date(),
        due_date: new Date(),
        subtotal,
        discount: effectiveDiscount,
        delivery_charge: deliveryCharges,
        slip_charges: slipCharges,
        total_amount: totalAmount,
        paid_amount: effectiveAmountPaid,
        cash_tendered: cashTendered,
        change_returned: changeReturned,
        requested_qty: invoiceRequestedTotal,
        fulfilled_qty: invoiceFulfilledTotal,
        deferred_qty: invoiceDeferredTotal,
        status: balanceDue <= 0 ? 'PAID' : (effectiveAmountPaid > 0 ? 'PARTIAL' : 'UNPAID'),
        notes: totalAmount < 0
          ? `POS Refund (${targetCustomer.name})`
          : isSplit
            ? `POS Sale (${targetCustomer.name}) [Split: Rs. ${splitCashNet} Cash + Rs. ${splitBankNet} Bank]`
            : `POS Sale (${targetCustomer.name})`,
        offline_id: options?.offline_id || null,
        offline_timestamp: options?.offline_timestamp ? Number(options.offline_timestamp) : null,
        created_by: userId,
      })
      .returning('*');

    (invoice as any).bill_number = nextBillNo;
    (invoice as any).payment_method = effectivePaymentMethod;
    (invoice as any).bank_account_id = targetBankId;
    (invoice as any).bank_name = targetBankName;
    (invoice as any).balance_due = balanceDue;
    (invoice as any).split_cash_amount = isSplit ? splitCashNet : (isBank ? 0 : effectiveAmountPaid);
    (invoice as any).split_bank_amount = isSplit ? splitBankNet : (isBank ? effectiveAmountPaid : 0);
    (invoice as any).delivery_charge = deliveryCharges;
    (invoice as any).delivery_charges = deliveryCharges;
    (invoice as any).slip_charges = slipCharges;
    (invoice as any).requested_qty = invoiceRequestedTotal;
    (invoice as any).fulfilled_qty = invoiceFulfilledTotal;
    (invoice as any).deferred_qty = invoiceDeferredTotal;

    // 3. Insert Sales Invoice Items
    const finalItems = invoiceItemsToInsert.map((i: any) => ({
      invoice_id: invoice.id,
      product_id: i.product_id,
      size: i.size || 'Standard',
      batch_id: i.batch_id,
      quantity: i.quantity,
      requested_qty: i.requested_qty ?? i.quantity,
      fulfilled_qty: i.fulfilled_qty ?? i.quantity,
      deferred_qty: i.deferred_qty ?? 0,
      selected_unit: i.selected_unit,
      actual_weight_per_unit: i.actual_weight_per_unit,
      net_kg_processed: i.net_kg_processed,
      applied_cogs_per_kg: i.applied_cogs_per_kg,
      unit_price: i.unit_price,
      total_price: i.total_price,
      is_deferred: i.is_deferred ?? false,
      estimated_cogs: i.estimated_cogs,
      actual_cogs: i.actual_cogs,
      name_urdu: i.name_urdu || null,
    }));
    const insertedDbItems = await trx('sales_invoice_items').insert(finalItems).returning('*');

    // Record Strict Batch Lineage for POS sales
    const posLineageRecords: any[] = [];
    for (let i = 0; i < invoiceItemsToInsert.length; i++) {
      const insertedItem = insertedDbItems[i];
      const depletions = (invoiceItemsToInsert[i] as any).batchDepletions || [];
      for (const dep of depletions) {
        posLineageRecords.push({
          sales_invoice_item_id: insertedItem.id,
          inventory_batch_id: dep.batch_id,
          qty_deducted: dep.qty_deducted,
          cogs_per_kg: dep.cogs_per_kg,
        });
      }
    }
    if (posLineageRecords.length > 0) {
      await trx('sales_invoice_item_batches').insert(posLineageRecords);
    }

    // Insert shortfall (missing_qty) into pending_deliveries (backorder) queue linked to this POS receipt
    for (let i = 0; i < invoiceItemsToInsert.length; i++) {
      const itemMeta: any = invoiceItemsToInsert[i];
      if (itemMeta.missing_qty > 0) {
        const insertedItem = insertedDbItems[i];
        await trx('pending_deliveries').insert({
          sales_invoice_id: invoice.id,
          sales_invoice_item_id: insertedItem.id,
          product_id: itemMeta.product_id,
          variant_id: itemMeta.variant_id || null,
          pending_qty: itemMeta.missing_qty,
          fulfilled_qty: 0,
          status: 'PENDING',
        });
      }
    }

    (invoice as any).items = insertedDbItems;

    // 4. Create Customer Payment & Liquidity Inflow (Cash in Drawer OR Bank Balance OR Split)
    if (effectiveAmountPaid > 0) {
      if (isSplit) {
        // 4a. Cash portion
        if (splitCashNet > 0) {
          await trx('customer_payments').insert({
            customer_id: targetCustomer.id,
            invoice_id: invoice.id,
            payment_number: `RCV-POS-${Date.now()}-${Math.floor(Math.random() * 1000)}-CASH`,
            payment_date: new Date(),
            amount: splitCashNet,
            payment_method: 'CASH',
            bank_account_id: null,
            notes: `POS Retail Cash Split Sale (Invoice #${invoice.invoice_number})`,
            cheque_status: 'CLEARED',
            created_by: userId,
          });

          const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
          if (hasCdl) {
            await trx('cash_drawer_ledger').insert({
              type: 'INFLOW',
              amount: splitCashNet,
              reference_id: invoice.id,
              description: `POS Retail Cash Split Sale: Invoice #${invoice.invoice_number}`,
              created_by: userId,
            });
          }
        }

        // 4b. Bank portion
        if (splitBankNet > 0 && targetBankId) {
          await trx('customer_payments').insert({
            customer_id: targetCustomer.id,
            invoice_id: invoice.id,
            payment_number: `RCV-POS-${Date.now()}-${Math.floor(Math.random() * 1000)}-BANK`,
            payment_date: new Date(),
            amount: splitBankNet,
            payment_method: 'BANK_TRANSFER',
            bank_account_id: targetBankId,
            notes: `POS Retail Bank Split Sale (Invoice #${invoice.invoice_number})`,
            cheque_status: 'CLEARED',
            created_by: userId,
          });

          await trx('bank_accounts')
            .where('id', targetBankId)
            .increment('current_balance', splitBankNet);

          const hasBankTx = await trx.schema.hasTable('bank_transactions');
          if (hasBankTx) {
            await trx('bank_transactions').insert({
              bank_account_id: targetBankId,
              transaction_type: 'DEPOSIT',
              type: 'INFLOW',
              amount: splitBankNet,
              source_type: 'POS',
              source: 'POS',
              reference_id: invoice.id,
              description: `POS Retail Split Sale: Invoice #${invoice.invoice_number}`,
              transaction_date: new Date(),
              category: 'SALES',
              created_by: userId,
            });
          }
        }
      } else {
        await trx('customer_payments').insert({
          customer_id: targetCustomer.id,
          invoice_id: invoice.id,
          payment_number: `RCV-POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          payment_date: new Date(),
          amount: effectiveAmountPaid,
          payment_method: isBank ? 'BANK_TRANSFER' : 'CASH',
          bank_account_id: isBank ? targetBankId : null,
          notes: isBank
            ? `POS Retail Bank Sale (Invoice #${invoice.invoice_number})`
            : `POS Retail Cash Sale (Invoice #${invoice.invoice_number})`,
          cheque_status: 'CLEARED',
          created_by: userId,
        });

        if (isBank && targetBankId) {
          // Increment bank account balance
          await trx('bank_accounts')
            .where('id', targetBankId)
            .increment('current_balance', effectiveAmountPaid);

          // Record Bank Transaction inflow
          const hasBankTx = await trx.schema.hasTable('bank_transactions');
          if (hasBankTx) {
            await trx('bank_transactions').insert({
              bank_account_id: targetBankId,
              transaction_type: 'DEPOSIT',
              type: 'INFLOW',
              amount: effectiveAmountPaid,
              source_type: 'POS',
              source: 'POS',
              reference_id: invoice.id,
              description: `POS Retail Sale: Invoice #${invoice.invoice_number}`,
              transaction_date: new Date(),
              category: 'SALES',
              created_by: userId,
            });
          }
        } else {
          // Inflow to Cash Drawer ledger
          const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
          if (hasCdl) {
            await trx('cash_drawer_ledger').insert({
              type: 'INFLOW',
              amount: effectiveAmountPaid,
              reference_id: invoice.id,
              description: `POS Retail Cash Sale: Invoice #${invoice.invoice_number}`,
              created_by: userId,
            });
          }
        }
      }
    } else if (effectiveAmountPaid < 0) {
      // Refund Handling
      const refundAmt = Math.abs(effectiveAmountPaid);
      await trx('customer_payments').insert({
        customer_id: targetCustomer.id,
        invoice_id: invoice.id,
        payment_number: `REF-POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        payment_date: new Date(),
        amount: -refundAmt,
        payment_method: isBank ? 'BANK_TRANSFER' : 'CASH_REFUND',
        bank_account_id: isBank ? targetBankId : null,
        notes: isBank
          ? `POS Refund via Bank (Invoice #${invoice.invoice_number})`
          : `POS Cash Refund (Invoice #${invoice.invoice_number})`,
        cheque_status: 'CLEARED',
        created_by: userId,
      });

      if (isBank && targetBankId) {
        await trx('bank_accounts')
          .where('id', targetBankId)
          .decrement('current_balance', refundAmt);

        const hasBankTx = await trx.schema.hasTable('bank_transactions');
        if (hasBankTx) {
          await trx('bank_transactions').insert({
            bank_account_id: targetBankId,
            transaction_type: 'WITHDRAWAL',
            type: 'OUTFLOW',
            amount: refundAmt,
            source_type: 'POS',
            source: 'POS',
            reference_id: invoice.id,
            description: `POS Refund: Invoice #${invoice.invoice_number}`,
            transaction_date: new Date(),
            category: 'REFUND',
            created_by: userId,
          });
        }
      } else {
        const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
        if (hasCdl) {
          await trx('cash_drawer_ledger').insert({
            type: 'OUTFLOW',
            amount: refundAmt,
            reference_id: invoice.id,
            description: `POS Cash Refund: Invoice #${invoice.invoice_number}`,
            created_by: userId,
          });
        }
      }
    }

    return invoice;
  });
}

export async function getTodayCashTally(_userId?: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Total Customer cash payments collected today (both POS retail sales and standalone payments)
  const salesCashResult = await db('customer_payments')
    .whereIn('payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
    .andWhere('amount', '>', 0)
    .where(function () {
      this.whereRaw('payment_date::text = ?', [todayStr])
        .orWhereBetween('payment_date', [startOfDay, endOfDay])
        .orWhereBetween('created_at', [startOfDay, endOfDay]);
    })
    .where(function () {
      this.whereNull('cheque_status')
        .orWhereNotIn('cheque_status', ['BOUNCED', 'FAILED']);
    })
    .sum('amount as total_cash')
    .first();

  const totalSalesCash = Number(salesCashResult?.total_cash || 0);
  const totalExtraCash = 0;

  // 2. Total Cash Refunds paid out to customers today
  const refundsResult = await db('customer_payments')
    .where(function () {
      this.whereIn('payment_method', ['CASH_REFUND', 'cash_refund'])
        .orWhere(function () {
          this.whereIn('payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
            .andWhere('amount', '<', 0);
        });
    })
    .where(function () {
      this.whereRaw('payment_date::text = ?', [todayStr])
        .orWhereBetween('payment_date', [startOfDay, endOfDay])
        .orWhereBetween('created_at', [startOfDay, endOfDay]);
    })
    .sum('amount as total_refunds')
    .first();

  const totalRefundsCash = Math.abs(Number(refundsResult?.total_refunds || 0));

  // 3. Total Petty Cash Expenses paid from register today
  const hasExpPay = await db.schema.hasTable('expense_payments');
  let totalExpensesCash = 0;
  if (hasExpPay) {
    const expensesResult = await db('expense_payments')
      .whereIn('payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
      .where(function () {
        this.whereRaw('payment_date::text = ?', [todayStr])
          .orWhereBetween('payment_date', [startOfDay, endOfDay])
          .orWhereBetween('created_at', [startOfDay, endOfDay]);
      })
      .sum('amount as total_expenses')
      .first();
    totalExpensesCash = Number(expensesResult?.total_expenses || 0);
  } else {
    const hasStatus = await db.schema.hasColumn('expenses', 'status');
    let expQuery = db('expenses')
      .whereIn('payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
      .where(function () {
        this.whereRaw('expense_date::text = ?', [todayStr])
          .orWhereBetween('expense_date', [startOfDay, endOfDay])
          .orWhereBetween('created_at', [startOfDay, endOfDay]);
      });
    if (hasStatus) {
      expQuery = expQuery.whereIn('status', ['PAID', 'PARTIAL']);
    }
    const expensesResult = await expQuery
      .sum('amount as total_expenses')
      .first();
    totalExpensesCash = Number(expensesResult?.total_expenses || 0);
  }

  return Math.max(0, Math.round((totalSalesCash + totalExtraCash - totalRefundsCash - totalExpensesCash) * 100) / 100);
}

export async function getCashierShiftAudit(userId: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  let isCashierOnly = false;
  if (userId) {
    const userRole = await db('users as u')
      .join('roles as r', 'u.role_id', 'r.id')
      .where('u.id', userId)
      .select('r.name as role_name')
      .first();
    isCashierOnly = userRole?.role_name?.toUpperCase() === 'CASHIER';
  }

  // 1. Fetch Sales Invoices
  let invoiceQuery = db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .where(function () {
      this.whereRaw('si.date::text = ?', [todayStr])
        .orWhereBetween('si.date', [startOfDay, endOfDay])
        .orWhereBetween('si.created_at', [startOfDay, endOfDay]);
    })
    .select(
      'si.id',
      'si.invoice_number',
      'si.date',
      'si.subtotal',
      'si.discount',
      'si.delivery_charge',
      'si.slip_charges',
      'si.total_amount',
      'si.paid_amount',
      'si.status',
      'si.created_at',
      'c.id as customer_id',
      'c.name as customer_name',
      'c.code as customer_code'
    )
    .orderBy('si.created_at', 'desc');

  if (isCashierOnly) {
    invoiceQuery = invoiceQuery.andWhere('si.created_by', userId);
  }

  const invoices = await invoiceQuery;

  let invoicesWithItems: any[] = [];

  if (invoices.length > 0) {
    const invoiceIds = invoices.map((inv) => inv.id);

    const items = await db('sales_invoice_items as sii')
      .join('products as p', 'sii.product_id', 'p.id')
      .whereIn('sii.invoice_id', invoiceIds)
      .select(
        'sii.id',
        'sii.invoice_id',
        'sii.product_id',
        'sii.quantity',
        'sii.selected_unit',
        'sii.actual_weight_per_unit',
        'sii.net_kg_processed',
        'sii.unit_price',
        'sii.total_price',
        'p.name as product_name',
        'p.code as product_code'
      );

    const itemsByInvoiceId: Record<string, typeof items> = {};
    for (const item of items) {
      if (!itemsByInvoiceId[item.invoice_id]) {
        itemsByInvoiceId[item.invoice_id] = [];
      }
      itemsByInvoiceId[item.invoice_id].push(item);
    }

    invoicesWithItems = invoices.map((inv) => ({
      ...inv,
      items: itemsByInvoiceId[inv.id] || [],
    }));
  }

  // 2. Fetch Customer Cash Refunds today
  let refundQuery = db('customer_payments as cp')
    .join('customers as c', 'cp.customer_id', 'c.id')
    .where(function () {
      this.whereRaw('cp.payment_date::text = ?', [todayStr])
        .orWhereBetween('cp.payment_date', [startOfDay, endOfDay])
        .orWhereBetween('cp.created_at', [startOfDay, endOfDay]);
    })
    .where(function () {
      this.whereIn('cp.payment_method', ['CASH_REFUND', 'cash_refund'])
        .orWhere(function () {
          this.whereIn('cp.payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
            .andWhere('cp.amount', '<', 0);
        });
    })
    .select(
      'cp.id',
      'cp.payment_number',
      'cp.payment_date',
      'cp.amount',
      'cp.notes',
      'cp.created_at',
      'c.id as customer_id',
      'c.name as customer_name',
      'c.code as customer_code'
    )
    .orderBy('cp.created_at', 'desc');

  if (isCashierOnly) {
    refundQuery = refundQuery.andWhere('cp.created_by', userId);
  }

  const refunds = await refundQuery;

  const formattedRefunds = refunds.map((r) => {
    const refundAmt = Math.abs(Number(r.amount));
    return {
      id: r.id,
      invoice_number: r.payment_number || `RFD-${r.id.slice(0, 8)}`,
      date: r.payment_date,
      subtotal: -refundAmt,
      discount: 0,
      total_amount: -refundAmt,
      paid_amount: -refundAmt,
      status: 'REFUND',
      created_at: r.created_at,
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      customer_code: r.customer_code,
      items: [
        {
          id: r.id,
          invoice_id: r.id,
          product_id: '',
          product_name: r.notes || 'Customer Cash Refund from Advance Wallet',
          product_code: 'REFUND',
          quantity: 1,
          selected_unit: 'CASH',
          actual_weight_per_unit: 0,
          net_kg_processed: 0,
          unit_price: -refundAmt,
          total_price: -refundAmt,
        },
      ],
    };
  });

  // 3. Fetch Cash Expenses today
  const expenses = await db('expenses as e')
    .where('e.created_by', userId)
    .whereBetween('e.expense_date', [startOfDay, endOfDay])
    .whereIn('e.payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
    .select('e.id', 'e.amount', 'e.category', 'e.description', 'e.expense_date', 'e.created_at')
    .orderBy('e.created_at', 'desc');

  const formattedExpenses = expenses.map((e) => {
    const expenseAmt = Math.abs(Number(e.amount));
    return {
      id: e.id,
      invoice_number: `EXP-${e.id.slice(0, 8).toUpperCase()}`,
      date: e.expense_date,
      subtotal: -expenseAmt,
      discount: 0,
      total_amount: -expenseAmt,
      paid_amount: -expenseAmt,
      status: 'EXPENSE',
      created_at: e.created_at,
      customer_id: '',
      customer_name: `Expense: ${e.category}`,
      customer_code: 'EXP',
      items: [
        {
          id: e.id,
          invoice_id: e.id,
          product_id: '',
          product_name: e.description || `${e.category} (Petty Cash from Drawer)`,
          product_code: 'EXP',
          quantity: 1,
          selected_unit: 'CASH',
          actual_weight_per_unit: 0,
          net_kg_processed: 0,
          unit_price: -expenseAmt,
          total_price: -expenseAmt,
        },
      ],
    };
  });

  const allEntries = [...invoicesWithItems, ...formattedRefunds, ...formattedExpenses];
  allEntries.sort(
    (a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
  );
  return allEntries;
}

export async function getPosInvoicesList(filter?: { created_by?: string }) {
  const query = db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .leftJoin('users as u', 'si.created_by', 'u.id')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .where('si.invoice_number', 'like', 'POS-%');

  if (filter?.created_by) {
    query.where('si.created_by', filter.created_by);
  }

  const invoices = await query
    .select(
      'si.id',
      'si.invoice_number',
      'si.date',
      'si.subtotal',
      'si.discount',
      'si.delivery_charge',
      'si.slip_charges',
      'si.total_amount',
      'si.paid_amount',
      'si.status',
      'si.notes',
      'si.created_by',
      'si.created_at',
      'c.id as customer_id',
      'c.name as customer_name',
      'c.code as customer_code',
      'u.name as created_by_name',
      'r.name as created_by_role'
    )
    .orderBy('si.created_at', 'desc');

  return invoices.map((inv) => ({
    ...inv,
    created_by_name: inv.created_by_name || 'System',
    created_by_role: inv.created_by_role || 'CASHIER',
    creator: {
      name: inv.created_by_name || 'System',
      role: inv.created_by_role || 'CASHIER',
    },
  }));
}

export async function createHeldOrder(input: any, userId?: string) {
  const countRes = await db('pos_held_orders').count('id as total').first();
  const currentCount = Number(countRes?.total || 0);

  const timeStr = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const refNote = input.reference_note && String(input.reference_note).trim()
    ? String(input.reference_note).trim()
    : `Hold #${currentCount + 1} - ${input.customer_name || 'Walk-In'} (${timeStr})`;

  const [heldOrder] = await db('pos_held_orders')
    .insert({
      reference_note: refNote,
      customer_id: input.customer_id || null,
      customer_name: input.customer_name || null,
      items: JSON.stringify(input.items),
      subtotal: input.subtotal || 0,
      discount: input.discount || 0,
      total_amount: input.total_amount,
      payment_method: input.payment_method || 'CASH',
      split_cash_amount: input.split_cash_amount || null,
      split_bank_amount: input.split_bank_amount || null,
      bank_account_id: input.bank_account_id || null,
      slip_mode: input.slip_mode || 'SINGLE',
      created_by: userId || null,
    })
    .returning('*');

  return {
    ...heldOrder,
    items: typeof heldOrder.items === 'string' ? JSON.parse(heldOrder.items) : heldOrder.items,
  };
}

export async function getHeldOrdersList() {
  const held = await db('pos_held_orders as pho')
    .leftJoin('users as u', 'pho.created_by', 'u.id')
    .select(
      'pho.*',
      'u.name as creator_name'
    )
    .orderBy('pho.created_at', 'desc');

  return held.map((order) => ({
    ...order,
    items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
    creator_name: order.creator_name || 'Cashier',
  }));
}

export async function deleteHeldOrder(id: string) {
  const deletedCount = await db('pos_held_orders')
    .where('id', id)
    .delete();

  return deletedCount > 0;
}


