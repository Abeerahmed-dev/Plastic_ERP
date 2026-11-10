import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasBalanceDue = await knex.schema.hasColumn('purchase_invoices', 'balance_due');
  if (!hasBalanceDue) {
    await knex.schema.alterTable('purchase_invoices', (table) => {
      table.decimal('balance_due', 14, 2).nullable();
    });
  }

  const hasReturns = await knex.schema.hasColumn('purchase_invoices', 'has_returns');
  if (!hasReturns) {
    await knex.schema.alterTable('purchase_invoices', (table) => {
      table.boolean('has_returns').notNullable().defaultTo(false);
      table.index('has_returns');
    });
  }

  // Backfill balance_due for existing purchase invoices where it is null
  await knex('purchase_invoices')
    .whereNull('balance_due')
    .update({
      balance_due: knex.raw('COALESCE(total_amount, 0) - COALESCE(paid_amount, 0)'),
    });

  // Flag existing parent purchase invoices that already have linked non-cancelled debit notes
  const existingDebitNotes = await knex('purchase_invoices')
    .where('invoice_type', 'DEBIT_NOTE')
    .whereNotNull('parent_invoice_id')
    .whereNot('status', 'CANCELLED')
    .select('parent_invoice_id');

  const parentIds = [...new Set(existingDebitNotes.map((r: any) => r.parent_invoice_id).filter(Boolean))];
  if (parentIds.length > 0) {
    await knex('purchase_invoices')
      .whereIn('id', parentIds)
      .update({ has_returns: true });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasReturns = await knex.schema.hasColumn('purchase_invoices', 'has_returns');
  if (hasReturns) {
    await knex.schema.alterTable('purchase_invoices', (table) => {
      table.dropIndex(['has_returns']);
      table.dropColumn('has_returns');
    });
  }

  const hasBalanceDue = await knex.schema.hasColumn('purchase_invoices', 'balance_due');
  if (hasBalanceDue) {
    await knex.schema.alterTable('purchase_invoices', (table) => {
      table.dropColumn('balance_due');
    });
  }
}

