import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { authRateLimiter, forgotPasswordRateLimiter } from '../../middleware/rateLimiter';
import {
  loginController,
  refreshController,
  logoutController,
  meController,
  forgotPasswordController,
  resetPasswordController,
} from './auth.controller';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Public — no token required (rate-limited against brute force).
 */
router.post('/login', authRateLimiter, loginController);

/**
 * POST /api/v1/auth/forgot-password
 * Public — sends reset link to user's email (rate-limited).
 */
router.post('/forgot-password', forgotPasswordRateLimiter, forgotPasswordController);

/**
 * POST /api/v1/auth/reset-password
 * Public — validates reset token and updates password (rate-limited).
 */
router.post('/reset-password', forgotPasswordRateLimiter, resetPasswordController);

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
