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

    // Tables that hold business transactions & operational data
    const candidateTables = [
      'payment_allocations',
      'supplier_payment_allocations',
      'customer_payments',
      'supplier_payments',
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
      'stock_alerts',
      'products',
      'customers',
      'suppliers',
      'employees',
      'cash_drawer_shifts',
      'refresh_tokens'
    ];

    const tablesToTruncate = candidateTables.filter(t => tableNames.includes(t));

    console.log('\n--- Step 1: Truncating operational tables with CASCADE ---');
    for (const table of tablesToTruncate) {
      console.log(` - Truncating table: ${table}`);
      await db.raw(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
    }

    // Reset bank accounts balance to 0 if bank_accounts exists
    if (tableNames.includes('bank_accounts')) {
      console.log('\n--- Step 2: Resetting bank_accounts initial_balance to 0.00 ---');
      await db('bank_accounts').update({ initial_balance: 0.00 });
      // Ensure primary account exists
      const primaryBank = await db('bank_accounts').first();
      if (!primaryBank) {
        await db('bank_accounts').insert({
          account_title: 'Primary Business Account',
          bank_name: 'Main Commercial Bank',
          account_number: '000000000000',
          initial_balance: 0.00,
          is_active: true,
        });
      }
    }

    // Ensure standard categories exist
    if (tableNames.includes('categories')) {
      console.log('\n--- Step 3: Checking default product categories ---');
      const defaultCategories = [
        { name: '30/s Poly', bag_weight_kg: 30.0, description: 'Standard 30/s Poly bags (30 KG/Bag)' },
        { name: '50/s Poly', bag_weight_kg: 50.0, description: 'Heavy duty 50/s Poly bags (50 KG/Bag)' },
        { name: 'Plastic Bag', bag_weight_kg: 25.0, description: 'Standard Plastic Bags (25 KG/Bag)' },
        { name: 'Roll', bag_weight_kg: 25.0, description: 'Plastic Rolls (25 KG/Bag)' },
        { name: 'Sheet', bag_weight_kg: 20.0, description: 'Plastic Sheets (20 KG/Bag)' },
        { name: 'Granules', bag_weight_kg: 25.0, description: 'Raw Plastic Granules (25 KG/Bag)' },
        { name: 'Packaging', bag_weight_kg: 25.0, description: 'Packaging Material (25 KG/Bag)' },
        { name: 'Other', bag_weight_kg: 25.0, description: 'General & Miscellaneous Products (25 KG/Bag)' },
      ];

      for (const cat of defaultCategories) {
        const existing = await db('categories').where({ name: cat.name }).first();
        if (!existing) {
          await db('categories').insert(cat);
          console.log(` + Added missing default category: ${cat.name}`);
        }
      }
    }

    console.log('\n--- Step 4: Verification of Table Counts ---');
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
      'cash_drawer_ledger',
      'bank_transactions',
      'incoming_pdcs',
      'inventory_transactions',
      'inventory_batches',
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

    console.log('\nDatabase cleanup complete!');
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

listAndClean();
