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
    let subtotal = 0;
    const itemsToInsert = [];

    for (const item of input.items) {
      const total_price = Number(item.quantity) * Number(item.unit_price);
      subtotal += total_price;

      const selected_unit = (item as any).selected_unit || 'KG';

      const product = await trx('products as p')
        .join('categories as c', 'p.category_id', 'c.id')
        .where('p.id', item.product_id)
        .select(
          'p.id',
          'p.name',
          'p.total_stock_kg',
          'p.rolling_avg_cost_per_kg',
          'p.min_markup_percent',
          'c.bag_weight_kg'
        )
        .first();

      if (!product) {
        throw new Error(`Product ${item.product_id} not found.`);
      }

      const bagWeight = Number(product.bag_weight_kg || 25.0);
      const unitMultiplier = (selected_unit.toLowerCase() === 'bag' || selected_unit.toLowerCase() === 'bora')
        ? bagWeight
        : 1.0;

      const sold_kg = Number(item.quantity) * unitMultiplier;
      const currentStock = Number(product.total_stock_kg || 0);

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
          batch_id: null,
          quantity: item.quantity,
          selected_unit,
          actual_weight_per_unit: unitMultiplier,
          net_kg_processed: sold_kg,
          applied_cogs_per_kg: avgCost,
          unit_price: item.unit_price,
          total_price,
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
        // ── SALE LINE ITEM: Deduct Stock ──
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
        const sellingPricePerKg = sold_kg > 0 ? (total_price / sold_kg) : Number(item.unit_price);

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

        itemsToInsert.push({
          product_id: item.product_id,
          batch_id: primaryBatchId,
          quantity: item.quantity,
          selected_unit,
          actual_weight_per_unit: unitMultiplier,
          net_kg_processed: sold_kg,
          applied_cogs_per_kg: appliedCogsPerKg,
          unit_price: item.unit_price,
          total_price,
        });

        // Record inventory transaction
        await trx('inventory_transactions').insert({
          product_id: item.product_id,
          transaction_type: 'SALE',
          quantity_kg: sold_kg,
          unit_cost: appliedCogsPerKg,
          total_asset_value: lineCogs,
          capital_equity_value: 0,
          notes: `Sales Invoice ${invoiceNumber}`,
          created_by: userId,
        });
      }
    }

    const deliveryCharge = Number((input as any).delivery_charge || 0);
    const total_amount = Math.max(0, subtotal - (input.discount || 0)) + deliveryCharge;

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

    const initialPaidAmount = Number((input as any).paid_amount || (input as any).amount_paid || 0);
    const invoiceStatus = initialPaidAmount >= total_amount ? 'PAID' : (initialPaidAmount > 0 ? 'PARTIAL' : 'UNPAID');

    // Insert Invoice
    const [invoice] = await trx('sales_invoices')
      .insert({
        customer_id: input.customer_id,
        invoice_number: invoiceNumber,
        invoice_type: 'SALE',
        date: input.date,
        due_date: input.due_date || null,
        subtotal,
        discount: input.discount || 0,
        delivery_charge: deliveryCharge,
        total_amount,
        paid_amount: initialPaidAmount,
        status: invoiceStatus,
        notes: input.notes,
        created_by: userId,
      })
      .returning('*');

    const invoiceId = invoice.id;

    // Insert Items with invoice_id
    const finalItems = itemsToInsert.map(item => ({
      ...item,
      invoice_id: invoiceId,
    }));

    await trx('sales_invoice_items').insert(finalItems);

    // Record initial customer payment if paid_amount was provided
    if (initialPaidAmount > 0) {
      await trx('customer_payments').insert({
        customer_id: input.customer_id,
        invoice_id: invoiceId,
        payment_number: `RCV-${invoiceNumber}`,
        payment_date: input.date || new Date().toISOString().split('T')[0],
        amount: initialPaidAmount,
        payment_method: (input as any).payment_method || 'CASH',
        bank_account_id: (input as any).bank_account_id || null,
        notes: `Payment for Invoice ${invoiceNumber}`,
        created_by: userId,
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
      const unitPrice = Number(parentItem.unit_price || 0);
      const lineTotal = itemInput.return_quantity * unitPrice;

      totalCreditAmount += lineTotal;

      // Restock the product in inventory
      await trx('products')
        .where({ id: itemInput.product_id })
        .update({
          total_stock_kg: trx.raw('total_stock_kg + ?', [returnKg]),
          updated_at: new Date(),
        });

      const avgCost = Number(parentItem.rolling_avg_cost_per_kg || 0);

      // Record RETURN inventory transaction
      await trx('inventory_transactions').insert({
        product_id: itemInput.product_id,
        transaction_type: 'RETURN',
        quantity_kg: returnKg,
        unit_cost: avgCost,
        total_asset_value: Math.round(returnKg * avgCost * 100) / 100,
        capital_equity_value: 0,
        notes: `Sales Return Credit Note (Parent: ${parentInvoice.invoice_number}) - Reason: ${input.return_reason}`,
        created_by: userId,
      });

      itemsToInsert.push({
        product_id: itemInput.product_id,
        batch_id: null,
        quantity: -Math.abs(itemInput.return_quantity),
        selected_unit: parentItem.selected_unit || 'KG',
        actual_weight_per_unit: unitMultiplier,
        net_kg_processed: -Math.abs(returnKg),
        applied_cogs_per_kg: avgCost,
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
        subtotal: -Math.abs(totalCreditAmount),
        discount: 0,
        total_amount: -Math.abs(totalCreditAmount),
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

export async function findAllInvoices() {
  const rows = await db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .leftJoin('users as u', 'si.created_by', 'u.id')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .where(function() {
      this.where('si.invoice_type', '!=', 'CREDIT_NOTE')
          .orWhereNull('si.invoice_type');
    })
    .whereNull('si.parent_invoice_id')
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
      'u.name as created_by_name',
      'r.name as created_by_role'
    )
    .orderBy('si.date', 'desc')
    .orderBy('si.created_at', 'desc');

  return rows.map((r) => ({
    ...r,
    created_by_name: r.created_by_name || 'System',
    created_by_role: r.created_by_role || 'ADMIN',
    creator: {
      name: r.created_by_name || 'System',
      role: r.created_by_role || 'ADMIN',
    },
  }));
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

  invoice.creator = {
    name: invoice.created_by_name || 'System',
    role: invoice.created_by_role || 'ADMIN',
  };

  const items = await db('sales_invoice_items as sii')
    .join('products as p', 'sii.product_id', 'p.id')
    .where('sii.invoice_id', id)
    .select(
      'sii.*',
      'p.name as product_name',
      'p.code as product_code',
      'p.size as product_size'
    );

  // Fetch child credit notes if any exist against this parent invoice
  const creditNotesRows = await db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .where({ 'si.parent_invoice_id': id, 'si.invoice_type': 'CREDIT_NOTE' })
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
        .where('sii.invoice_id', cn.id)
        .select(
          'sii.*',
          'p.name as product_name',
          'p.code as product_code',
          'p.size as product_size'
        );
      return { ...cn, items: cnItems };
    })
  );

  return { ...invoice, items, credit_notes };
}

