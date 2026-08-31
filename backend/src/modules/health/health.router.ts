import { Router, Request, Response } from 'express';
import { ok } from '../../shared/apiResponse';
import db from '../../db/knex';
import { logger } from '../../config/logger';

const router = Router();

/**
 * GET /api/v1/health
 *
 * Returns service status and DB connectivity.
 * Used by load-balancers, monitoring, and Docker HEALTHCHECK.
 */
router.get('/', async (_req: Request, res: Response) => {
  let dbStatus: 'ok' | 'error' = 'error';

  try {
    await db.raw('SELECT 1');
    dbStatus = 'ok';
  } catch (err) {
    logger.error({ err }, 'Health check: DB connection failed');
  }

  const status = dbStatus === 'ok' ? 200 : 503;

  res.status(status).json(
    ok({
      service: 'Sabir Plastic ERP API',
      version: '0.1.0',
      status: dbStatus === 'ok' ? 'healthy' : 'degraded',
      db: dbStatus,
      timestamp: new Date().toISOString(),
    }),
  );
});

export default router;
