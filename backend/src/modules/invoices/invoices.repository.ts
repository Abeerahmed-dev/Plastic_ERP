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
    // Calculate totals
    let subtotal = 0;
    const items = input.items.map(item => {
      const total_price = item.quantity * item.unit_price;
      subtotal += total_price;
      return {
        ...item,
        total_price
      };
    });

    const total_amount = subtotal - (input.discount || 0);

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
      .returning('id');

    const invoiceId = invoice.id;

    // Insert Items
    const itemsToInsert = items.map(item => ({
      invoice_id: invoiceId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price
    }));

    await trx('sales_invoice_items').insert(itemsToInsert);

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
      'c.code as customer_code'
    )
    .first();

  if (!invoice) return null;

  const items = await db('sales_invoice_items as sii')
    .join('products as p', 'sii.product_id', 'p.id')
    .where('sii.invoice_id', id)
    .select(
      'sii.*',
      'p.name as product_name',
      'p.code as product_code'
    );

  return { ...invoice, items };
}
