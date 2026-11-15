import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('incoming_pdcs');
  if (!hasTable) {
    await knex.schema.createTable('incoming_pdcs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('payment_id').references('id').inTable('customer_payments').onDelete('CASCADE').nullable();
      table.uuid('customer_id').notNullable().references('id').inTable('customers').onDelete('CASCADE');
      table.uuid('destination_bank_account_id').nullable().references('id').inTable('bank_accounts').onDelete('SET NULL');
      table.string('cheque_number', 100).notNullable();
      table.string('cheque_bank_name', 150).notNullable();
      table.date('cheque_due_date').notNullable();
      table.decimal('amount', 15, 2).notNullable();
      table.string('status', 30).notNullable().defaultTo('PENDING'); // PENDING, CLEARED, BOUNCED
      table.text('notes').nullable();
      table.uuid('created_by').nullable();
      table.timestamps(true, true);

      table.index('customer_id');
      table.index('destination_bank_account_id');
      table.index('status');
      table.index('cheque_due_date');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('incoming_pdcs');
}
