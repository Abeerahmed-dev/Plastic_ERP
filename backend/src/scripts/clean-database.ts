import db from '../db/knex';

async function listAndClean() {
  try {
    const res = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableNames: string[] = res.rows.map((r: any) => r.table_name);
    console.log('All existing tables in database:');
    console.log(tableNames.join(', '));

    // Operational and transactional tables
    const candidateTables = [
      'pos_held_orders',
      'product_exchanges',
      'pending_deliveries',
      'payment_allocations',
      'supplier_payment_allocations',
      'customer_payments',
      'supplier_payments',
      'expense_payments',
      'expenses',
      'cash_drawer_ledger',
      'bank_transactions',
      'incoming_pdcs',
      'sales_invoice_items',
      'sales_invoices',
      'purchase_invoice_items',
      'purchase_invoices',
      'inventory_transactions',
      'inventory_batches',
      'employee_ledger',
      'stock_alerts',
      'products',
      'customers',
      'suppliers',
      'employees',
      'cash_drawer_shifts',
      'refresh_tokens'
    ];

    const tablesToTruncate = candidateTables.filter(t => tableNames.includes(t));

    console.log('\n--- Step 1: Truncating operational and transactional tables with CASCADE ---');
    for (const table of tablesToTruncate) {
      console.log(` - Truncating table: ${table}`);
      await db.raw(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
    }

    // Clean inactive / orphaned user accounts (keeping active accounts with email)
    if (tableNames.includes('users')) {
      console.log('\n--- Step 2: Cleaning inactive/orphaned test accounts ---');
      const deletedUsers = await db('users').whereNull('email').del();
      console.log(` - Removed ${deletedUsers} orphaned user records without email.`);
    }

    // Reset bank accounts
    if (tableNames.includes('bank_accounts')) {
      console.log('\n--- Step 3: Resetting bank_accounts to default with 0.00 balance ---');
      // Delete non-primary test accounts
      await db('bank_accounts').whereNot('account_title', 'Primary Business Account').del();
      
      const primaryBank = await db('bank_accounts').where({ account_title: 'Primary Business Account' }).first();
      if (primaryBank) {
        await db('bank_accounts').where({ id: primaryBank.id }).update({ initial_balance: 0.00, current_balance: 0.00 });
      } else {
        await db('bank_accounts').insert({
          account_title: 'Primary Business Account',
          bank_name: 'Main Commercial Bank',
          account_number: '000000000000',
          initial_balance: 0.00,
          current_balance: 0.00,
          is_active: true,
        });
      }
      console.log(' - bank_accounts reset to single Primary Business Account with 0.00 balance.');
    }

    // Ensure Walk-in Customer exists
    if (tableNames.includes('customers')) {
      console.log('\n--- Step 4: Ensuring default Walk-in Customer exists ---');
      const walkIn = await db('customers').where({ code: 'WALK-IN' }).first();
      if (!walkIn) {
        await db('customers').insert({
          code: 'WALK-IN',
          name: 'Walk-in Customer',
          phone: '00000000000',
          address: 'POS Default Customer',
          opening_balance: 0,
        });
        console.log(' - Re-seeded WALK-IN Customer.');
      }
    }

    console.log('\n--- Step 5: Verification of Table Counts ---');
    const verificationTables = [
      'sales_invoices',
      'sales_invoice_items',
      'purchase_invoices',
      'purchase_invoice_items',
      'customer_payments',
      'payment_allocations',
      'supplier_payments',
      'supplier_payment_allocations',
      'expenses',
      'expense_payments',
      'cash_drawer_ledger',
      'bank_transactions',
      'incoming_pdcs',
      'inventory_transactions',
      'inventory_batches',
      'employee_ledger',
      'pos_held_orders',
      'product_exchanges',
      'pending_deliveries',
      'products',
      'customers',
      'suppliers',
      'employees',
      'bank_accounts',
      'categories',
      'users'
    ].filter(t => tableNames.includes(t));

    for (const t of verificationTables) {
      const [{ count }] = await db(t).count('* as count');
      console.log(` - ${t.padEnd(30)} : ${count} records`);
    }

    console.log('\nDatabase cleanup complete! All entries have been removed and balances reset to 0.00.');
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

listAndClean();
