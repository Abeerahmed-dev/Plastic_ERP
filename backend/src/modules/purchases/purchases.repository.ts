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
  const invoice = await db('purchase_invoices')
    .join('suppliers', 'purchase_invoices.supplier_id', 'suppliers.id')
    .where('purchase_invoices.id', id)
    .select(
      'purchase_invoices.*',
      'suppliers.name as supplier_name',
      'suppliers.code as supplier_code'
    )
    .first();

  if (!invoice) return undefined;

  const items = await db('purchase_invoice_items')
    .join('products', 'purchase_invoice_items.product_id', 'products.id')
    .where('purchase_invoice_id', id)
    .select(
      'purchase_invoice_items.*',
      'products.name as product_name',
      'products.code as product_code'
    );

  return { ...invoice, items };
}

export async function createPurchaseInvoice(data: any, createdBy: string) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const invoice_number = await generatePurchaseInvoiceNumber();

    let subtotal = 0;
    const itemsToInsert = [];

    // Calculate item totals
    for (const item of data.items) {
      const itemTotal = Number(item.quantity) * Number(item.unit_price);
      subtotal += itemTotal;
      itemsToInsert.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: itemTotal,
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

    await trx('purchase_invoice_items').insert(itemsWithInvoiceId);

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
