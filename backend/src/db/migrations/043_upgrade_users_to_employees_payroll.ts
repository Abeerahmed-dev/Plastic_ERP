import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Decouple auth: make email, password_hash, and role_id nullable
  await knex.raw(`
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    ALTER TABLE users ALTER COLUMN role_id DROP NOT NULL;
  `);

  // 2. Add HR & Payroll columns if they don't already exist
  const hasJobTitle = await knex.schema.hasColumn('users', 'job_title');
  if (!hasJobTitle) {
    await knex.schema.alterTable('users', (table) => {
      table.string('job_title', 100).nullable();
    });
  }

  const hasJoiningDate = await knex.schema.hasColumn('users', 'joining_date');
  if (!hasJoiningDate) {
    await knex.schema.alterTable('users', (table) => {
      table.date('joining_date').nullable().defaultTo(knex.raw('CURRENT_DATE'));
    });
  }

  const hasPayFrequency = await knex.schema.hasColumn('users', 'pay_frequency');
  if (!hasPayFrequency) {
    await knex.schema.alterTable('users', (table) => {
      table.string('pay_frequency', 20).notNullable().defaultTo('MONTHLY');
    });
  }

  const hasBaseSalary = await knex.schema.hasColumn('users', 'base_salary');
  if (!hasBaseSalary) {
    await knex.schema.alterTable('users', (table) => {
      table.decimal('base_salary', 14, 2).notNullable().defaultTo(0);
    });
  }

  const hasLastPaidDate = await knex.schema.hasColumn('users', 'last_paid_date');
  if (!hasLastPaidDate) {
    await knex.schema.alterTable('users', (table) => {
      table.date('last_paid_date').nullable();
    });
  }

  // 3. Backfill joining_date for existing users from created_at
  await knex.raw(`
    UPDATE users 
    SET joining_date = created_at::date 
    WHERE joining_date IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  const hasLastPaidDate = await knex.schema.hasColumn('users', 'last_paid_date');
  if (hasLastPaidDate) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('last_paid_date');
    });
  }

  const hasBaseSalary = await knex.schema.hasColumn('users', 'base_salary');
  if (hasBaseSalary) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('base_salary');
    });
  }

  const hasPayFrequency = await knex.schema.hasColumn('users', 'pay_frequency');
  if (hasPayFrequency) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('pay_frequency');
    });
  }

  const hasJoiningDate = await knex.schema.hasColumn('users', 'joining_date');
  if (hasJoiningDate) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('joining_date');
    });
  }

  const hasJobTitle = await knex.schema.hasColumn('users', 'job_title');
  if (hasJobTitle) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('job_title');
    });
  }
}
