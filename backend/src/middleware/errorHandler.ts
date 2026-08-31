import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';
import { fail } from '../shared/apiResponse';
import { logger } from '../config/logger';
import { env } from '../config/env';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation error
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const key = e.path.join('.');
      details[key] = details[key] ?? [];
      details[key].push(e.message);
    });
    res.status(400).json(fail('Validation failed', details));
    return;
  }

  // Known operational error
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err }, 'Unexpected operational error');
    }
    res.status(err.statusCode).json(fail(err.message));
    return;
  }

  // Unknown / programming error
  logger.error({ err }, 'Unhandled error');
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : String(err);
  res.status(500).json(fail(message));
}
