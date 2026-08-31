import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import db from './db/knex';

async function main() {
  // Verify DB connection before accepting traffic
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection established');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to database — check DB_* environment variables');
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Sabir Plastic ERP API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // ─── Graceful shutdown ──────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await db.destroy();
      logger.info('Database pool closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
