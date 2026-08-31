import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../shared/errors';
import { AuthUser } from '../shared/types';

interface JwtPayload {
  sub: string;         // user id
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

/**
 * requireAuth middleware
 *
 * Reads the Bearer token from the Authorization header,
 * verifies it, and attaches the decoded user to req.user.
 *
 * Throws UnauthorizedError (401) on any failure.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Authorization header missing or malformed'));
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const authUser: AuthUser = {
      id: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      roleId: decoded.roleId,
      roleName: decoded.roleName,
      permissions: decoded.permissions,
    };

    req.user = authUser;
    next();
  } catch {
    next(new UnauthorizedError('Token invalid or expired'));
  }
}
