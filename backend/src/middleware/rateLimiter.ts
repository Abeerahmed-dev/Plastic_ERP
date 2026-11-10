import rateLimit from 'express-rate-limit';

/**
 * Global API rate limiter — prevents DDoS and high-frequency hammering.
 * Allows up to 1000 requests per 15 minutes per IP.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.',
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});

/**
 * Auth rate limiter for login — stops brute-force password guessing.
 * Max 15 attempts per 1 minute per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts. Please wait 1 minute before trying again.',
    message: 'Too many login attempts. Please wait 1 minute before trying again.',
  },
});

/**
 * Forgot password rate limiter — prevents email quota exhaustion and spamming.
 * Max 5 requests per 15 minutes per IP.
 */
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many password reset requests. Please wait 15 minutes before requesting another link.',
    message: 'Too many password reset requests. Please wait 15 minutes before requesting another link.',
  },
});

