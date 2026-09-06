import db from '../../db/knex';
import { Knex } from 'knex';
import { WALKIN_CUSTOMER_PHONE } from '../../db/seeds/06_walkin_customer';

export async function processPOSCheckout(
  userId: string,
  items: { product_id: string; batch_id?: string | null; quantity: number; selected_unit?: string; unit_price: number }[],
  discount: number
) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    // 1. Find the Walk-in Customer
    const walkin = await trx('customers').where({ phone: WALKIN_CUSTOMER_PHONE }).first();
    if (!walkin) {
      throw new Error('Walk-in customer not found in database. Run seeds.');
    }

    // Calculate Subtotal & Process Items with Batch Validation & Deduction
    let subtotal = 0;
    const invoiceItemsToInsert = [];

    for (const item of items) {
      const lineTotal = Number(item.quantity) * Number(item.unit_price);
      subtotal += lineTotal;

      const selected_unit = item.selected_unit || 'Dasti';

      // Strict Batch Validation & Lock
      if (!item.batch_id) {
        throw new Error("A specific batch MUST be selected for every line item.");
      }

      const batch = await trx('inventory_batches').where({ id: item.batch_id }).first();
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
      const sellingPricePerKg = net_kg_deducted > 0 ? (lineTotal / net_kg_deducted) : Number(item.unit_price);

      if (sellingPricePerKg < floorPricePerKg - 0.01) {
        throw new Error("Selling price below minimum authorized margin.");
      }

      // Exact COGS calculation
      const lineCogs = Math.round(net_kg_deducted * batchBuyPrice * 100) / 100;

      // Deduct stock from batch
      await trx('inventory_batches')
        .where({ id: batch.id })
        .update({
          remaining_qty: trx.raw('remaining_qty - ?', [net_kg_deducted]),
          updated_at: new Date(),
        });

      invoiceItemsToInsert.push({
        product_id: item.product_id,
        batch_id: batch.id,
        quantity: item.quantity,
        selected_unit,
        actual_weight_per_unit: unitMultiplier,
        net_kg_processed: net_kg_deducted,
        unit_price: item.unit_price,
        total_price: lineTotal,
      });

      // Record inventory transaction
      await trx('inventory_transactions').insert({
        product_id: item.product_id,
        transaction_type: 'SALE',
        quantity_kg: net_kg_deducted,
        unit_cost: batchBuyPrice,
        total_asset_value: lineCogs,
        capital_equity_value: 0,
        notes: 'POS Walk-in Sale',
        created_by: userId,
      });
    }

    const totalAmount = subtotal - discount;

    // 2. Create Sales Invoice
    const [invoice] = await trx('sales_invoices')
      .insert({
        customer_id: walkin.id,
        invoice_number: `POS-${Date.now()}`,
        date: new Date(),
        due_date: new Date(),
        subtotal,
        discount,
        total_amount: totalAmount,
        paid_amount: totalAmount,
        status: 'PAID',
        notes: 'POS Walk-in Sale',
        created_by: userId,
      })
      .returning('*');

    // 3. Insert Sales Invoice Items
    const finalItems = invoiceItemsToInsert.map((i) => ({
      ...i,
      invoice_id: invoice.id,
    }));
    await trx('sales_invoice_items').insert(finalItems);

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
