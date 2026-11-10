import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './config/logger';
import { env } from './config/env';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './modules/health/health.router';
import authRouter from './modules/auth/auth.router';
import usersRouter from './modules/users/users.router';
import customersRouter from './modules/customers/customers.router';
import suppliersRouter from './modules/suppliers/suppliers.router';
import categoriesRouter from './modules/categories/categories.router';
import productsRouter from './modules/products/products.router';
import invoicesRouter from './modules/invoices/invoices.router';
import { syncOfflineInvoices } from './modules/invoices/invoices.controller';
import paymentsRouter from './modules/payments/payments.router';
import advancesRouter from './modules/advances/advances.router';
import refundsRouter from './modules/refunds/refunds.router';
import { purchasesRouter } from './modules/purchases/purchases.router';
import purchaseReturnsRouter from './modules/purchases/purchase-returns.router';
import supplierPaymentsRouter from './modules/supplier-payments/supplier-payments.router';
import { expensesRouter } from './modules/expenses/expenses.router';
import { posRouter } from './modules/pos/pos.router';
import { reportsRouter } from './modules/reports/reports.router';
import { onboardingRouter } from './modules/onboarding/onboarding.router';
import bankAccountsRouter from './modules/bank-accounts/bank-accounts.router';
import incomingPdcsRouter from './modules/incoming-pdcs/incoming-pdcs.router';
import customerRefundsRouter from './modules/customer-refunds/customer-refunds.router';
import inventoryRouter from './modules/inventory/inventory.router';
import { employeesRouter } from './modules/employees/employees.router';
import { exchangesRouter } from './modules/exchanges/exchanges.router';
import settingsRouter from './modules/settings/settings.router';
import devRouter from './modules/dev/dev.router';
import { fail, ok } from './shared/apiResponse';

export function createApp(): Application {
  const app = express();

  // ─── Trust proxy (for rate limiting & client IP behind Nginx/Cloudflare/VPS) ───
  app.set('trust proxy', 1);

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

  const allowedOrigins = [
    env.FRONTEND_URL.replace(/\/$/, ''),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow mobile apps, curl, server-to-server or development
        if (!origin || env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Blocked by CORS policy for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─── Rate limiting ─────────────────────────────
  app.use('/api', apiRateLimiter);

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
  app.use('/api/v1/inventory', inventoryRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/v1/invoices', invoicesRouter);
  app.use('/api/invoices', invoicesRouter);
  app.post('/api/v1/sync-offline', syncOfflineInvoices);
  app.post('/api/sync-offline', syncOfflineInvoices);
  app.use('/api/v1/sales', invoicesRouter);
  app.use('/api/sales', invoicesRouter);
  app.use('/api/v1/purchases', purchasesRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/v1/purchase-invoices', purchasesRouter);
  app.use('/api/purchase-invoices', purchasesRouter);
  app.use('/api/v1/purchase-returns', purchaseReturnsRouter);
  app.use('/api/purchase-returns', purchaseReturnsRouter);
  app.use('/api/v1/supplier-payments', supplierPaymentsRouter);
  app.use('/api/supplier-payments', supplierPaymentsRouter);
  app.use('/api/v1/customer-payments', paymentsRouter);
  app.use('/api/customer-payments', paymentsRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/v1/advances', advancesRouter);
  app.use('/api/advances', advancesRouter);
  app.use('/api/v1/refunds', refundsRouter);
  app.use('/api/refunds', refundsRouter);
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
  app.use('/api/v1/employees', employeesRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/v1/exchanges', exchangesRouter);
  app.use('/api/exchanges', exchangesRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/v1/onboarding', onboardingRouter);
  // ─── Development only routes ───────────────────
  if (env.NODE_ENV !== 'production') {
    app.use('/api/dev', devRouter);
    app.use('/api/v1/dev', devRouter);
  }

  // ─── 404 handler ─────────────────────────────
  app.use((_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json(fail('Route not found'));
  });

  // ─── Global error handler (must be last) ─────
  app.use(errorHandler);

  return app;
}
