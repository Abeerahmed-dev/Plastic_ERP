import { Request, Response, NextFunction } from 'express';
import db from '../../db/knex';

export async function resetDatabaseController(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Environment Guard: Strict security check
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Database reset is forbidden in production environments.' });
      return;
    }

    const operationalTables = [
      'customer_payments',
      'supplier_payments',
      'expenses',
      'sales_invoice_items',
      'sales_invoices',
      'purchase_invoice_items',
      'purchase_invoices',
      'inventory_transactions',
      'inventory_batches',
      'products',
      'customers',
      'suppliers',
      'categories',
      'units_of_measure',
    ];

    const existingTables: string[] = [];
    for (const tableName of operationalTables) {
      const exists = await db.schema.hasTable(tableName);
      if (exists) {
        existingTables.push(tableName);
      }
    }

    if (existingTables.length > 0) {
      await db.raw(`TRUNCATE TABLE ${existingTables.join(', ')} RESTART IDENTITY CASCADE;`);
    }

    res.status(200).json({
      success: true,
      message: 'Operational database tables successfully wiped and identity sequences reset.',
      truncated_tables: existingTables,
    });
  } catch (err) {
    next(err);
  }
}
