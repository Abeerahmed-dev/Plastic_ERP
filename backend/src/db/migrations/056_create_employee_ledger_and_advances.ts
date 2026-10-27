import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('employee_ledger');
  if (!exists) {
    await knex.schema.createTable('employee_ledger', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table
        .uuid('employee_id')
        .notNullable()
        .references('id')
        .inTable('employees')
        .onDelete('CASCADE');
      table.string('transaction_type', 30).notNullable(); // 'SALARY' (Credit), 'ADVANCE' (Debit), 'PAYMENT' (Debit), 'BONUS' (Credit), 'DEDUCTION' (Debit)
      table.date('date').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
      table.string('reference_month', 7).notNullable(); // e.g. '2026-10'
      table.text('description').nullable();
      table.decimal('amount', 12, 2).notNullable();
      table.string('payment_method', 50).notNullable().defaultTo('CASH'); // 'CASH', 'BANK_TRANSFER', 'CHEQUE'
      table
        .uuid('bank_account_id')
        .nullable()
        .references('id')
        .inTable('bank_accounts')
        .onDelete('SET NULL');
      table
        .uuid('created_by')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL');
      table.timestamps(true, true);

      table.index('employee_id');
      table.index('date');
      table.index('reference_month');
      table.index('transaction_type');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('employee_ledger');
}
