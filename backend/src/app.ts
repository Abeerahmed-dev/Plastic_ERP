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
import uomRouter from './modules/uom/uom.router';
import productsRouter from './modules/products/products.router';
import invoicesRouter from './modules/invoices/invoices.router';
import paymentsRouter from './modules/payments/payments.router';
import { purchasesRouter } from './modules/purchases/purchases.router';
import supplierPaymentsRouter from './modules/supplier-payments/supplier-payments.router';
import { posRouter } from './modules/pos/pos.router';
import { reportsRouter } from './modules/reports/reports.router';
import { onboardingRouter } from './modules/onboarding/onboarding.router';
import { fail } from './shared/apiResponse';

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
  app.use('/api/v1/suppliers', suppliersRouter);
  app.use('/api/v1/uom', uomRouter);
  app.use('/api/v1/products', productsRouter);
  app.use('/api/v1/invoices', invoicesRouter);
  app.use('/api/v1/sales', invoicesRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/purchases', purchasesRouter);
  app.use('/api/v1/supplier-payments', supplierPaymentsRouter);
  app.use('/api/v1/pos', posRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/onboarding', onboardingRouter);

  // ─── 404 handler ─────────────────────────────
  app.use((_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json(fail('Route not found'));
  });

  // ─── Global error handler (must be last) ─────
  app.use(errorHandler);

  return app;
}
