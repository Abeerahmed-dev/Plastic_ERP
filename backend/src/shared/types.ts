import { Request } from 'express';

/**
 * The authenticated user object attached to every request
 * by the requireAuth middleware.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[]; // e.g. ["customers:read", "sales:write"]
}

/**
 * Augment Express Request so req.user is typed everywhere.
 * Import this file anywhere you use req.user.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export type { Request };
