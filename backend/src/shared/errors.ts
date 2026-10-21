/**
 * AppError — typed application error with HTTP status code.
 *
 * Throw this anywhere in service/controller layers; the global
 * error handler middleware catches it and sends the correct response.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class InsufficientStockError extends AppError {
  public readonly remainingStock: number;

  constructor(remainingStock: number, message?: string) {
    const msg = message || `Transaction failed: Another user just purchased this stock. Remaining: ${remainingStock}`;
    super(msg, 400);
    this.name = 'InsufficientStockError';
    this.remainingStock = remainingStock;
  }
}

export class InsufficientLiquidityError extends AppError {
  constructor(message = 'INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.') {
    super(message, 400);
    this.name = 'InsufficientLiquidityError';
  }
}

