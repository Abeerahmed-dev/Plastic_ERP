import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('payment_allocations');
  if (!hasTable) {
    await knex.schema.createTable('payment_allocations', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('payment_id').notNullable().references('id').inTable('customer_payments').onDelete('CASCADE');
      table.uuid('invoice_id').notNullable().references('id').inTable('sales_invoices').onDelete('CASCADE');
      table.decimal('allocated_amount', 14, 2).notNullable();
      table.timestamps(true, true);

      table.index('payment_id');
      table.index('invoice_id');
    });

    // Backfill existing payments linked to invoices
    const historicPayments = await knex('customer_payments')
      .whereNotNull('invoice_id')
      .select('id', 'invoice_id', 'amount');

    for (const pay of historicPayments) {
      const inv = await knex('sales_invoices').where('id', pay.invoice_id).select('total_amount').first();
      if (inv) {
        const allocated = Math.min(Number(pay.amount), Number(inv.total_amount));
        if (allocated > 0) {
          await knex('payment_allocations').insert({
            payment_id: pay.id,
            invoice_id: pay.invoice_id,
            allocated_amount: allocated,
          });
        }
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payment_allocations');
}
