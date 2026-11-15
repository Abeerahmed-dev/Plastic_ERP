import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../shared/errors';

/**
 * requirePermission middleware factory
 *
 * Usage:
 *   router.get('/', requireAuth, requirePermission('customers:read'), controller.list)
 *
 * Must be used AFTER requireAuth (which populates req.user).
 */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const userRole = (req.user.roleName || '').toUpperCase();
    if (userRole === 'OWNER' || userRole === 'ADMIN') {
      return next();
    }

    if (!req.user.permissions.includes(permission)) {
      return next(
        new ForbiddenError(
          `Permission denied: '${permission}' required`,
        ),
      );
    }

    next();
  };
}
