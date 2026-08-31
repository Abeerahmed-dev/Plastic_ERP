import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import {
  loginController,
  refreshController,
  logoutController,
  meController,
} from './auth.controller';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Public — no token required.
 */
router.post('/login', loginController);

/**
 * POST /api/v1/auth/refresh
 * Public — uses refresh token in body.
 */
router.post('/refresh', refreshController);

/**
 * POST /api/v1/auth/logout
 * Protected — revokes the provided refresh token.
 */
router.post('/logout', requireAuth, logoutController);

/**
 * GET /api/v1/auth/me
 * Protected — returns current user profile + permissions.
 */
router.get('/me', requireAuth, meController);

export default router;
