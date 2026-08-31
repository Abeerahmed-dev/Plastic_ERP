import db from '../../db/knex';
import { Knex } from 'knex';
import { WALKIN_CUSTOMER_PHONE } from '../../db/seeds/06_walkin_customer';

export async function processPOSCheckout(
  userId: string,
  items: { product_id: string; quantity: number; unit_price: number }[],
  discount: number
) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    // 1. Find the Walk-in Customer
    const walkin = await trx('customers').where({ phone: WALKIN_CUSTOMER_PHONE }).first();
    if (!walkin) {
      throw new Error('Walk-in customer not found in database. Run seeds.');
    }

    // Calculate Subtotal
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.quantity * item.unit_price;
    }
    const totalAmount = subtotal - discount;

    // 2. Create Sales Invoice
    const [invoice] = await trx('sales_invoices')
      .insert({
        customer_id: walkin.id,
        date: new Date(),
        due_date: new Date(),
        subtotal,
        discount,
        total_amount: totalAmount,
        paid_amount: totalAmount, // Fully paid immediately
        status: 'PAID',
        notes: 'POS Walk-in Sale',
        created_by: userId,
      })
      .returning('*');

    // 3. Create Invoice Items
    const invoiceItems = items.map((item) => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.quantity * item.unit_price,
    }));
    await trx('sales_invoice_items').insert(invoiceItems);

    // 4. Create Customer Payment (CASH)
    if (totalAmount > 0) {
      await trx('customer_payments').insert({
        customer_id: walkin.id,
        sales_invoice_id: invoice.id,
        payment_date: new Date(),
        amount: totalAmount,
        payment_method: 'CASH',
        notes: 'POS Cash Payment',
        created_by: userId,
      });
    }

    return invoice;
  });
}
