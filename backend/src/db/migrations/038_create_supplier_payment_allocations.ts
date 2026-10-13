import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('supplier_payment_allocations');
  if (!hasTable) {
    await knex.schema.createTable('supplier_payment_allocations', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('payment_id').notNullable().references('id').inTable('supplier_payments').onDelete('CASCADE');
      table.uuid('purchase_invoice_id').notNullable().references('id').inTable('purchase_invoices').onDelete('CASCADE');
      table.decimal('allocated_amount', 14, 2).notNullable();
      table.timestamps(true, true);

      table.index('payment_id');
      table.index('purchase_invoice_id');
    });

    // Backfill existing historic supplier payments linked to purchase invoices
    const historicPayments = await knex('supplier_payments')
      .whereNotNull('purchase_invoice_id')
      .select('id', 'purchase_invoice_id', 'amount');

    for (const pay of historicPayments) {
      const inv = await knex('purchase_invoices').where('id', pay.purchase_invoice_id).select('total_amount').first();
      if (inv) {
        const allocated = Math.min(Number(pay.amount), Number(inv.total_amount));
        if (allocated > 0) {
          await knex('supplier_payment_allocations').insert({
            payment_id: pay.id,
            purchase_invoice_id: pay.purchase_invoice_id,
            allocated_amount: allocated,
          });
        }
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('supplier_payment_allocations');
}
