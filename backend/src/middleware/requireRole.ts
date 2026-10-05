import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../shared/errors';

/**
 * verifyRole / requireRole middleware factory
 *
 * Usage:
 *   router.delete('/:id', requireAuth, verifyRole(['OWNER', 'ADMIN']), controller.delete)
 */
export function verifyRole(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const userRole = (req.user.roleName || (req.user as Record<string, any>).role || '').toUpperCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

    if (!normalizedAllowed.includes(userRole)) {
      return next(
        new ForbiddenError(
          `Access denied: Operation requires one of the following roles: ${allowedRoles.join(', ')}`,
        ),
      );
    }

    next();
  };
}

export function forbidRole(forbiddenRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const userRole = (req.user.roleName || (req.user as Record<string, any>).role || '').toUpperCase();
    const normalizedForbidden = forbiddenRoles.map((r) => r.toUpperCase());

    if (normalizedForbidden.includes(userRole)) {
      return next(
        new ForbiddenError(
          'Access denied: Cashiers are strictly forbidden from processing customer or supplier liquidity payments.',
        ),
      );
    }

    next();
  };
}

export const requireRole = verifyRole;
