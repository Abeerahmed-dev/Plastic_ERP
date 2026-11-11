import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './config/logger';
import { env } from './config/env';
import { requireAuth } from './middleware/requireAuth';
import { requirePermission } from './middleware/requirePermission';
import { verifyRole } from './middleware/requireRole';
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
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: [
            "'self'",
            'http://localhost:5173',
            'ws://localhost:5173',
            'http://127.0.0.1:5173',
            'ws://127.0.0.1:5173',
            env.FRONTEND_URL.replace(/\/$/, ''),
          ],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  const allowedOrigins = Array.from(
    new Set([
      env.FRONTEND_URL.replace(/\/$/, ''),
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ]),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow mobile apps, curl, server-to-server or explicitly whitelisted origins
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Clean rejection without throwing 500 server error
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── Rate limiting ─────────────────────────────
  app.use('/api', apiRateLimiter);

  // ─── HTTP request logging ──────────────────────
  app.use(pinoHttp({ logger }));

  // ─── API routes ───────────────────────────────
  const v1Router = express.Router();

  v1Router.use('/health', healthRouter);
  v1Router.use('/auth', authRouter);
  v1Router.use('/users', usersRouter);
  v1Router.use('/customers', customersRouter);
  v1Router.use('/suppliers', suppliersRouter);
  v1Router.use('/categories', categoriesRouter);
  v1Router.use('/uom', (_req: Request, res: Response) => res.json(ok([]))); // Deprecated fallback
  v1Router.use('/products', productsRouter);
  v1Router.use('/inventory', inventoryRouter);
  v1Router.use('/invoices', invoicesRouter);
  v1Router.post(
    '/sync-offline',
    requireAuth,
    requirePermission('sales:write'),
    verifyRole(['OWNER', 'ADMIN', 'CASHIER']),
    syncOfflineInvoices
  );
  v1Router.use('/sales', invoicesRouter);
  v1Router.use('/purchases', purchasesRouter);
  v1Router.use('/purchase-invoices', purchasesRouter);
  v1Router.use('/purchase-returns', purchaseReturnsRouter);
  v1Router.use('/supplier-payments', supplierPaymentsRouter);
  v1Router.use('/customer-payments', paymentsRouter);
  v1Router.use('/payments', paymentsRouter);
  v1Router.use('/advances', advancesRouter);
  v1Router.use('/refunds', refundsRouter);
  v1Router.use('/expenses', expensesRouter);
  v1Router.use('/pos', posRouter);
  v1Router.use('/reports', reportsRouter);
  v1Router.use('/bank-accounts', bankAccountsRouter);
  v1Router.use('/banks', bankAccountsRouter);
  v1Router.use('/incoming-pdcs', incomingPdcsRouter);
  v1Router.use('/customer-refunds', customerRefundsRouter);
  v1Router.use('/employees', employeesRouter);
  v1Router.use('/exchanges', exchangesRouter);
  v1Router.use('/settings', settingsRouter);
  v1Router.use('/onboarding', onboardingRouter);

  // ─── Development only routes ───────────────────
  if (env.NODE_ENV !== 'production') {
    v1Router.use('/dev', devRouter);
  }

  // Mount canonical API v1, plus unversioned /api fallback
  app.use('/api/v1', v1Router);
  app.use('/api', v1Router);

  // ─── Monolith: Serve Compiled Frontend SPA ───
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));

    // Handle React client-side SPA routing (serves index.html for all non-API paths)
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.url.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  }

  // ─── 404 handler for unknown API routes ──────
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json(fail('API route not found'));
  });

  // Catch-all 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json(fail('Route not found'));
  });

  // ─── Global error handler (must be last) ─────
  app.use(errorHandler);

  return app;
}
