import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './modules/health/health.router';
import authRouter from './modules/auth/auth.router';
import usersRouter from './modules/users/users.router';
import customersRouter from './modules/customers/customers.router';
import suppliersRouter from './modules/suppliers/suppliers.router';
import categoriesRouter from './modules/categories/categories.router';
import productsRouter from './modules/products/products.router';
import invoicesRouter from './modules/invoices/invoices.router';
import paymentsRouter from './modules/payments/payments.router';
import { purchasesRouter } from './modules/purchases/purchases.router';
import supplierPaymentsRouter from './modules/supplier-payments/supplier-payments.router';
import { expensesRouter } from './modules/expenses/expenses.router';
import { posRouter } from './modules/pos/pos.router';
import { reportsRouter } from './modules/reports/reports.router';
import { onboardingRouter } from './modules/onboarding/onboarding.router';
import bankAccountsRouter from './modules/bank-accounts/bank-accounts.router';
import incomingPdcsRouter from './modules/incoming-pdcs/incoming-pdcs.router';
import customerRefundsRouter from './modules/customer-refunds/customer-refunds.router';
import devRouter from './modules/dev/dev.router';
import { fail, ok } from './shared/apiResponse';

export function createApp(): Application {
  const app = express();

  // ─── Disable ETag & Cache for JSON APIs ───────
  app.disable('etag');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // ─── Security & parsing ────────────────────────
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── HTTP request logging ──────────────────────
  app.use(pinoHttp({ logger }));

  // ─── API routes ───────────────────────────────
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/customers', customersRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/v1/suppliers', suppliersRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/uom', (_req: Request, res: Response) => res.json(ok([]))); // Deprecated fallback
  app.use('/api/v1/products', productsRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/v1/invoices', invoicesRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/v1/sales', invoicesRouter);
  app.use('/api/sales', invoicesRouter);
  app.use('/api/v1/purchases', purchasesRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/v1/supplier-payments', supplierPaymentsRouter);
  app.use('/api/supplier-payments', supplierPaymentsRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/v1/expenses', expensesRouter);
  app.use('/api/expenses', expensesRouter);
  app.use('/api/v1/pos', posRouter);
  app.use('/api/pos', posRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/v1/bank-accounts', bankAccountsRouter);
  app.use('/api/bank-accounts', bankAccountsRouter);
  app.use('/api/v1/banks', bankAccountsRouter);
  app.use('/api/banks', bankAccountsRouter);
  app.use('/api/v1/incoming-pdcs', incomingPdcsRouter);
  app.use('/api/incoming-pdcs', incomingPdcsRouter);
  app.use('/api/v1/customer-refunds', customerRefundsRouter);
  app.use('/api/customer-refunds', customerRefundsRouter);
  app.use('/api/v1/onboarding', onboardingRouter);
  app.use('/api/dev', devRouter);
  app.use('/api/v1/dev', devRouter);

  // ─── 404 handler ─────────────────────────────
  app.use((_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json(fail('Route not found'));
  });

  // ─── Global error handler (must be last) ─────
  app.use(errorHandler);

  return app;
}
