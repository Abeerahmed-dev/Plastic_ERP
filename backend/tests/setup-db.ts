import dotenv from 'dotenv';
import path from 'path';

// Force NODE_ENV to test
process.env.NODE_ENV = 'test';

// Explicitly load .env.test before any other database configuration
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

// Ensure dedicated test database name (must append _test to avoid mutating development ledger)
const rawDbName = process.env.DB_NAME_TEST || process.env.DB_NAME || 'sabir_plastic_erp_test';
const testDbName = rawDbName.endsWith('_test') ? rawDbName : `${rawDbName}_test`;
process.env.DB_NAME_TEST = testDbName;
process.env.DB_NAME = testDbName;

import db from '../src/db/knex';
import { Knex } from 'knex';

// Transactional and operational tables to be truncated between tests for pristine isolation
export const TRANSACTIONAL_TABLES: string[] = [
  'pos_held_orders',
  'product_exchanges',
  'pending_deliveries',
  'supplier_payment_allocations',
  'payment_allocations',
  'customer_payments',
  'supplier_payments',
  'expense_payments',
  'expenses',
  'cash_drawer_ledger',
  'bank_transactions',
  'incoming_pdcs',
  'sales_invoice_item_batches',
  'sales_invoice_items',
  'sales_invoices',
  'purchase_invoice_items',
  'purchase_invoices',
  'inventory_transactions',
  'inventory_batches',
  'employee_ledger',
  'stock_alerts',
  'products',
  'categories',
  'customers',
  'suppliers',
  'employees',
  'cash_drawer_shifts',
  'refresh_tokens',
];

/**
 * Truncate all transactional tables with CASCADE and RESTART IDENTITY
 * to guarantee complete isolation without full drop overhead.
 */
export async function truncateAllTables(knexInstance: Knex = db): Promise<void> {
  const currentDbRes = await knexInstance.raw('SELECT current_database();');
  const activeDb = currentDbRes.rows[0]?.current_database;

  // Strict Defensive Wall: Assert connection is to an isolated test database
  if (!activeDb || !activeDb.endsWith('_test')) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Attempted to truncate tables on non-test database "${activeDb}". Operation aborted.`
    );
  }

  const existingTablesRes = await knexInstance.raw(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
  `);
  const existingTables: string[] = existingTablesRes.rows.map((r: any) => r.table_name);

  const tablesToClear = TRANSACTIONAL_TABLES.filter((t) => existingTables.includes(t));
  if (tablesToClear.length > 0) {
    const truncateQuery = `TRUNCATE TABLE ${tablesToClear.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
    await knexInstance.raw(truncateQuery);
  }
}

/**
 * Helper to ensure baseline user and roles exist after truncation
 */
export async function ensureBaselineSeeds(knexInstance: Knex = db): Promise<void> {
  // Check if owner user exists
  const owner = await knexInstance('users').where({ email: 'owner@sabir.local' }).first();
  if (!owner) {
    // Run seed files to restore baseline roles and users
    await knexInstance.seed.run();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// JEST LIFECYCLE HOOKS (For integration test suites)
// ────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const testPath = expect.getState().testPath || '';
  if (!testPath.includes('integration')) {
    return; // Skip database setup for pure unit tests
  }

  // Verify connected database is indeed a test database
  const res = await db.raw('SELECT current_database();');
  const activeDb = res.rows[0]?.current_database;
  if (!activeDb || !activeDb.endsWith('_test')) {
    throw new Error(
      `CRITICAL GUARD: Integration tests must connect to a dedicated test database (ending in _test). Current database: ${activeDb}`
    );
  }

  // Run latest migrations on the test database
  await db.migrate.latest();

  // Ensure baseline seed data
  await ensureBaselineSeeds(db);
});

beforeEach(async () => {
  const testPath = expect.getState().testPath || '';
  if (!testPath.includes('integration')) {
    return;
  }

  // Ensure database migrations are current and baseline seeds are present
  await ensureBaselineSeeds(db);
});

afterEach(async () => {
  const testPath = expect.getState().testPath || '';
  if (!testPath.includes('integration')) {
    return;
  }

  // Clean all transactional tables after each test to guarantee pristine isolation
  await truncateAllTables(db);
  await ensureBaselineSeeds(db);
});

afterAll(async () => {
  // Global teardown hook; process exits with --forceExit
});
