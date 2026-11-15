import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, InsufficientStockError } from '../shared/errors';
import { fail } from '../shared/apiResponse';
import { logger } from '../config/logger';
import { env } from '../config/env';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Concurrency Wall: Catch INSUFFICIENT_STOCK errors
  if (
    err instanceof InsufficientStockError ||
    (err instanceof Error && (err.message === 'INSUFFICIENT_STOCK' || err.message.startsWith('INSUFFICIENT_STOCK')))
  ) {
    let remainingStock = 0;
    if (err instanceof InsufficientStockError) {
      remainingStock = err.remainingStock;
    } else if ((err as any).remainingStock !== undefined) {
      remainingStock = Number((err as any).remainingStock);
    } else if (err.message.includes(':')) {
      remainingStock = Number(err.message.split(':')[1]) || 0;
    }

    const message = `Transaction failed: Another user just purchased this stock. Remaining: ${remainingStock}`;
    res.status(400).json({
      success: false,
      error: message,
      message,
    });
    return;
  }

  // Liquidity Wall: Catch INSUFFICIENT_LIQUIDITY errors
  if (
    (err instanceof Error && (err.message.startsWith('INSUFFICIENT_LIQUIDITY') || err.name === 'InsufficientLiquidityError')) ||
    (typeof err === 'object' && err !== null && (err as any).name === 'InsufficientLiquidityError')
  ) {
    const message = (err as Error).message || 'INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.';
    res.status(400).json({
      success: false,
      error: message,
      message,
    });
    return;
  }

  // Validation Error Wall: Catch VALIDATION_ERROR prefix errors
  if (err instanceof Error && err.message.startsWith('VALIDATION_ERROR')) {
    res.status(400).json({
      success: false,
      error: err.message,
      message: err.message,
    });
    return;
  }

  // Not Found Wall: Catch NOT_FOUND prefix errors
  if (err instanceof Error && err.message.startsWith('NOT_FOUND')) {
    res.status(404).json({
      success: false,
      error: err.message,
      message: err.message,
    });
    return;
  }

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
