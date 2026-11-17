import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasStatus = await knex.schema.hasColumn('sales_invoices', 'status');
  if (!hasStatus) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.string('status', 30).notNullable().defaultTo('ACTIVE');
      table.index('status');
    });
  } else {
    await knex.raw("ALTER TABLE sales_invoices ALTER COLUMN status SET DEFAULT 'ACTIVE'");
  }

  const hasVoidReason = await knex.schema.hasColumn('sales_invoices', 'void_reason');
  if (!hasVoidReason) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.text('void_reason').nullable();
    });
  }

  const hasVoidedAt = await knex.schema.hasColumn('sales_invoices', 'voided_at');
  if (!hasVoidedAt) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.timestamp('voided_at', { useTz: true }).nullable();
    });
  }

  const hasVoidedBy = await knex.schema.hasColumn('sales_invoices', 'voided_by_user_id');
  if (!hasVoidedBy) {
    await knex.schema.alterTable('sales_invoices', (table) => {
      table.uuid('voided_by_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.index('voided_by_user_id');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasVoidedBy = await knex.schema.hasColumn('sales_invoices', 'voided_by_user_id');
  const hasVoidedAt = await knex.schema.hasColumn('sales_invoices', 'voided_at');
  const hasVoidReason = await knex.schema.hasColumn('sales_invoices', 'void_reason');

  await knex.schema.alterTable('sales_invoices', (table) => {
    if (hasVoidedBy) table.dropColumn('voided_by_user_id');
    if (hasVoidedAt) table.dropColumn('voided_at');
    if (hasVoidReason) table.dropColumn('void_reason');
  });
}

