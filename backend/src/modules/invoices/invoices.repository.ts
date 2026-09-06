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
  total_amount: number;
  paid_amount: number;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function generateNextInvoiceNumber(): Promise<string> {
  const row = await db('sales_invoices')
    .where('invoice_number', 'like', 'INV-%')
    .orderBy('invoice_number', 'desc')
    .first('invoice_number');

  if (!row || !row.invoice_number) {
    return 'INV-00001';
  }

  const numPart = row.invoice_number.replace('INV-', '');
  const nextNum = parseInt(numPart, 10) + 1;
  return `INV-${nextNum.toString().padStart(5, '0')}`;
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

      const selected_unit = (item as any).selected_unit || 'Dasti';

      // ── Strict Batch Validation & Lock ──
      if (!(item as any).batch_id) {
        throw new Error("A specific batch MUST be selected for every line item.");
      }

      const batch = await trx('inventory_batches').where({ id: (item as any).batch_id }).first();
      if (!batch) {
        throw new Error("Selected stock batch was not found or has been depleted.");
      }

      const conversions = typeof batch.batch_unit_conversions === 'string'
        ? JSON.parse(batch.batch_unit_conversions)
        : (batch.batch_unit_conversions || { Dasti: 0.5, Bora: 25.0, Peti: 15.0, Pura: 5.0, KG: 1.0 });

      const unitMultiplier = conversions[selected_unit] !== undefined
        ? Number(conversions[selected_unit])
        : Number(batch.actual_weight_per_unit || 1.0);

      const net_kg_deducted = Number(item.quantity) * unitMultiplier;

      if (net_kg_deducted > Number(batch.remaining_qty)) {
        throw new Error(
          `Insufficient stock in selected batch ${batch.batch_number} (Requested: ${net_kg_deducted} KG, Remaining: ${batch.remaining_qty} KG).`
        );
      }

      // ── Price Floor Check ──
      const product = await trx('products').where({ id: item.product_id }).first();
      const minMarkupPercent = Number(product?.min_markup_percent ?? 5.00);
      const batchBuyPrice = Number(batch.buy_price_per_kg || 0);
      const floorPricePerKg = batchBuyPrice * (1 + (minMarkupPercent / 100));
      const sellingPricePerKg = net_kg_deducted > 0 ? (total_price / net_kg_deducted) : Number(item.unit_price);

      if (sellingPricePerKg < floorPricePerKg - 0.01) {
        throw new Error("Selling price below minimum authorized margin.");
      }

      // Exact COGS calculation from batch buy price
      const lineCogs = Math.round(net_kg_deducted * batchBuyPrice * 100) / 100;

      // Deduct stock from batch
      await trx('inventory_batches')
        .where({ id: batch.id })
        .update({
          remaining_qty: trx.raw('remaining_qty - ?', [net_kg_deducted]),
          updated_at: new Date(),
        });

      itemsToInsert.push({
        product_id: item.product_id,
        batch_id: batch.id,
        quantity: item.quantity,
        selected_unit,
        actual_weight_per_unit: unitMultiplier,
        net_kg_processed: net_kg_deducted,
        unit_price: item.unit_price,
        total_price,
      });

      // Record inventory transaction
      await trx('inventory_transactions').insert({
        product_id: item.product_id,
        transaction_type: 'SALE',
        quantity_kg: net_kg_deducted,
        unit_cost: batchBuyPrice,
        total_asset_value: lineCogs,
        capital_equity_value: 0,
        notes: `Sales Invoice ${invoiceNumber}`,
        created_by: userId,
      });
    }

    const total_amount = subtotal - (input.discount || 0);

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

    // Insert Invoice
    const [invoice] = await trx('sales_invoices')
      .insert({
        customer_id: input.customer_id,
        invoice_number: invoiceNumber,
        date: input.date,
        due_date: input.due_date || null,
        subtotal,
        discount: input.discount || 0,
        total_amount,
        paid_amount: 0,
        status: 'UNPAID',
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

    return invoiceId;
  });
}

export async function findAllInvoices() {
  return db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .select(
      'si.id',
      'si.invoice_number',
      'si.date',
      'si.due_date',
      'si.total_amount',
      'si.paid_amount',
      'si.status',
      'c.id as customer_id',
      'c.name as customer_name',
      'c.code as customer_code'
    )
    .orderBy('si.date', 'desc')
    .orderBy('si.created_at', 'desc');
}

export async function findInvoiceById(id: string) {
  const invoice = await db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .where('si.id', id)
    .select(
      'si.*',
      'c.name as customer_name',
      'c.code as customer_code',
      'c.phone as customer_phone',
      'c.city as customer_city'
    )
    .first();

  if (!invoice) return null;

  const items = await db('sales_invoice_items as sii')
    .join('products as p', 'sii.product_id', 'p.id')
    .leftJoin('inventory_batches as ib', 'sii.batch_id', 'ib.id')
    .where('sii.invoice_id', id)
    .select(
      'sii.*',
      'p.name as product_name',
      'p.code as product_code',
      'ib.batch_number',
      'ib.actual_weight_per_unit as batch_weight_per_unit',
      'ib.selected_unit as batch_selected_unit'
    );

  return { ...invoice, items };
}
