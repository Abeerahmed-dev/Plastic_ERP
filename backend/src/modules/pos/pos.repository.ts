import db from '../../db/knex';
import { Knex } from 'knex';
import { WALKIN_CUSTOMER_PHONE } from '../../db/seeds/06_walkin_customer';

import { ForbiddenError } from '../../shared/errors';

export async function processPOSCheckout(
  userId: string,
  items: { product_id: string; quantity: number; selected_unit?: string; unit_price: number }[],
  discount: number,
  userRole?: string,
  customerId?: string,
  amountPaidInput?: number,
  paymentMethodInput?: string,
  bankAccountId?: string | null
) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const isCashier = userRole?.toUpperCase() === 'CASHIER';

    if (isCashier && discount > 0) {
      throw new ForbiddenError('Cashiers are not authorized to issue discounts or credit. Invoice must be paid in full.');
    }

    const effectiveDiscount = isCashier ? 0 : discount;

    // 1. Customer Selection
    let targetCustomer = null;
    if (customerId) {
      targetCustomer = await trx('customers').where({ id: customerId }).first();
    }
    if (!targetCustomer) {
      targetCustomer = await trx('customers').where({ phone: WALKIN_CUSTOMER_PHONE }).first();
    }
    if (!targetCustomer) {
      throw new Error('Customer not found in database.');
    }

    let subtotal = 0;
    const invoiceItemsToInsert = [];

    for (const item of items) {
      const selected_unit = item.selected_unit || 'KG';

      // Fetch Product & Category
      const product = await trx('products as p')
        .join('categories as c', 'p.category_id', 'c.id')
        .where('p.id', item.product_id)
        .select(
          'p.id',
          'p.name',
          'p.total_stock_kg',
          'p.rolling_avg_cost_per_kg',
          'p.fixed_retail_price_per_kg',
          'p.sale_price',
          'p.min_markup_percent',
          'c.bag_weight_kg'
        )
        .first();

      if (!product) {
        throw new Error(`Product ${item.product_id} not found.`);
      }

      // Unit multiplier (default Bag wt if Bag selected, else 1 for KG)
      const bagWeight = Number(product.bag_weight_kg || 25.0);
      const unitMultiplier = (selected_unit.toLowerCase() === 'bag' || selected_unit.toLowerCase() === 'bora')
        ? bagWeight
        : 1.0;

      const fixedRetailKg = Number(product.fixed_retail_price_per_kg || product.sale_price || 0);
      const effectiveUnitPrice = isCashier ? (fixedRetailKg * unitMultiplier) : Number(item.unit_price);
      const lineTotal = Number(item.quantity) * effectiveUnitPrice;
      subtotal += lineTotal;

      const isReturn = Number(item.quantity) < 0;

      if (isReturn) {
        const absQty = Math.abs(Number(item.quantity));
        const abs_kg = absQty * unitMultiplier;
        const sold_kg = -abs_kg; // negative quantity
        const lineTotal = Number(item.quantity) * effectiveUnitPrice; // negative total
        subtotal += lineTotal;

        const appliedCogsPerKg = Number(product.rolling_avg_cost_per_kg || product.cost_price || 0);
        const lineCogs = Math.round((abs_kg * appliedCogsPerKg) * 100) / 100;

        // Reverse inventory: Add stock back into product total
        await trx('products')
          .where({ id: product.id })
          .update({
            total_stock_kg: trx.raw('total_stock_kg + ?', [abs_kg]),
            updated_at: new Date(),
          });

        invoiceItemsToInsert.push({
          product_id: item.product_id,
          batch_id: null,
          quantity: item.quantity,
          selected_unit,
          actual_weight_per_unit: unitMultiplier,
          net_kg_processed: sold_kg,
          applied_cogs_per_kg: appliedCogsPerKg,
          unit_price: effectiveUnitPrice,
          total_price: lineTotal,
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
        const currentStock = Number(product.total_stock_kg || 0);

        if (sold_kg > currentStock) {
          throw new Error(
            `Insufficient stock for ${product.name} (Requested: ${sold_kg} KG, Available: ${currentStock} KG).`
          );
        }

        // ── Auto-FIFO Price-Bucket Stock Deduction ──
        const activeBuckets = await trx('inventory_batches')
          .where('product_id', item.product_id)
          .andWhere('remaining_qty', '>', 0)
          .orderBy('created_at', 'asc'); // Oldest first

        let kgToDeduct = sold_kg;
        let totalLineCogs = 0;
        let primaryBatchId: string | null = null;

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

            totalLineCogs += kgToDeduct * buyPrice;
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

            totalLineCogs += available * buyPrice;
            kgToDeduct -= available;
          }
        }

        const appliedCogsPerKg = sold_kg > 0
          ? Math.round((totalLineCogs / sold_kg) * 10000) / 10000
          : Number(product.rolling_avg_cost_per_kg || 0);
        const lineCogs = Math.round(totalLineCogs * 100) / 100;

        // Price Floor Check against rolling average cost
        const minMarkupPercent = Number(product.min_markup_percent ?? 5.00);
        const floorPricePerKg = appliedCogsPerKg * (1 + (minMarkupPercent / 100));
        const sellingPricePerKg = sold_kg > 0 ? (lineTotal / sold_kg) : Number(item.unit_price);

        if (sellingPricePerKg < floorPricePerKg - 0.01) {
          throw new Error(`Selling price for ${product.name} is below minimum authorized margin.`);
        }

        // Deduct stock from product
        await trx('products')
          .where({ id: product.id })
          .update({
            total_stock_kg: trx.raw('total_stock_kg - ?', [sold_kg]),
            updated_at: new Date(),
          });

        invoiceItemsToInsert.push({
          product_id: item.product_id,
          batch_id: primaryBatchId,
          quantity: item.quantity,
          selected_unit,
          actual_weight_per_unit: unitMultiplier,
          net_kg_processed: sold_kg,
          applied_cogs_per_kg: appliedCogsPerKg,
          unit_price: effectiveUnitPrice,
          total_price: lineTotal,
        });

        // Record inventory transaction
        await trx('inventory_transactions').insert({
          product_id: item.product_id,
          transaction_type: 'SALE',
          quantity_kg: sold_kg,
          unit_cost: appliedCogsPerKg,
          total_asset_value: lineCogs,
          capital_equity_value: 0,
          notes: `POS Sale (${targetCustomer.name})`,
          created_by: userId,
        });
      }
    }

    const totalAmount = subtotal - effectiveDiscount;

    const effectiveAmountPaid = amountPaidInput !== undefined ? Number(amountPaidInput) : totalAmount;
    const balanceDue = totalAmount - effectiveAmountPaid;

    if (isCashier && effectiveAmountPaid > totalAmount + 0.01) {
      throw new ForbiddenError('Cashiers cannot receive excess ledger payments.');
    }

    const effectivePaymentMethod = isCashier ? 'CASH' : (paymentMethodInput || 'CASH');

    // 2. Create Sales Invoice
    const [invoice] = await trx('sales_invoices')
      .insert({
        customer_id: targetCustomer.id,
        invoice_number: `POS-${Date.now()}`,
        invoice_type: 'SALE',
        date: new Date(),
        due_date: new Date(),
        subtotal,
        discount: effectiveDiscount,
        total_amount: totalAmount,
        paid_amount: effectiveAmountPaid,
        status: balanceDue <= 0 ? 'PAID' : (effectiveAmountPaid > 0 ? 'PARTIAL' : 'UNPAID'),
        notes: totalAmount < 0 ? `POS Refund (${targetCustomer.name})` : `POS Sale (${targetCustomer.name})`,
        created_by: userId,
      })
      .returning('*');

    // 3. Insert Sales Invoice Items
    const finalItems = invoiceItemsToInsert.map((i) => ({
      ...i,
      invoice_id: invoice.id,
    }));
    await trx('sales_invoice_items').insert(finalItems);

    // 4. Create Customer Payment
    if (effectiveAmountPaid !== 0) {
      await trx('customer_payments').insert({
        customer_id: targetCustomer.id,
        invoice_id: invoice.id,
        payment_number: `RCV-POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        payment_date: new Date(),
        amount: effectiveAmountPaid,
        payment_method: effectivePaymentMethod,
        bank_account_id: bankAccountId || null,
        notes: effectiveAmountPaid < 0 ? 'POS Refund' : 'POS Payment',
        created_by: userId,
      });
    }

    if (balanceDue > 0) {
      await trx('customers')
        .where({ id: targetCustomer.id })
        .update({
          current_balance: trx.raw('current_balance + ?', [balanceDue]),
          updated_at: new Date(),
        });
    }

    return invoice;
  });
}

export async function getTodayCashTally(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Total POS Sales cash collected today
  const salesResult = await db('sales_invoices')
    .where('created_by', userId)
    .whereBetween('date', [startOfDay, endOfDay])
    .whereNot('status', 'CANCELLED')
    .sum('paid_amount as total_cash')
    .first();

  const totalSalesCash = Number(salesResult?.total_cash || 0);

  // 2. Total Cash Refunds paid out to customers today
  const refundsResult = await db('customer_payments')
    .where('created_by', userId)
    .whereBetween('payment_date', [startOfDay, endOfDay])
    .where(function() {
      this.whereIn('payment_method', ['CASH_REFUND', 'cash_refund'])
        .orWhere(function() {
          this.whereIn('payment_method', ['CASH', 'Cash', 'CASH_DRAWER'])
            .andWhere('amount', '<', 0);
        });
    })
    .sum('amount as total_refunds')
    .first();

  const totalRefundsCash = Math.abs(Number(refundsResult?.total_refunds || 0));

  // 3. Total Petty Cash Expenses paid from register today
  const expensesResult = await db('expenses')
    .where('created_by', userId)
    .whereBetween('expense_date', [startOfDay, endOfDay])
    .whereIn('payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
    .sum('amount as total_expenses')
    .first();

  const totalExpensesCash = Number(expensesResult?.total_expenses || 0);

  return Math.max(0, Math.round((totalSalesCash - totalRefundsCash - totalExpensesCash) * 100) / 100);
}

export async function getCashierShiftAudit(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Fetch Sales Invoices
  const invoices = await db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .where('si.created_by', userId)
    .whereBetween('si.date', [startOfDay, endOfDay])
    .select(
      'si.id',
      'si.invoice_number',
      'si.date',
      'si.subtotal',
      'si.discount',
      'si.total_amount',
      'si.paid_amount',
      'si.status',
      'si.created_at',
      'c.id as customer_id',
      'c.name as customer_name',
      'c.code as customer_code'
    )
    .orderBy('si.created_at', 'desc');

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
  const refunds = await db('customer_payments as cp')
    .join('customers as c', 'cp.customer_id', 'c.id')
    .where('cp.created_by', userId)
    .whereBetween('cp.payment_date', [startOfDay, endOfDay])
    .where(function() {
      this.whereIn('cp.payment_method', ['CASH_REFUND', 'cash_refund'])
        .orWhere(function() {
          this.whereIn('cp.payment_method', ['CASH', 'Cash', 'CASH_DRAWER'])
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


