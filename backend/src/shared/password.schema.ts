import { z } from 'zod';

/**
 * Standard password complexity policy across Sabir Plastic ERP:
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - At least one letter (a-z, A-Z)
 * - At least one number (0-9)
 */
export const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export function isValidPassword(password?: string | null): boolean {
  if (!password || password.length < 8 || password.length > 128) {
    return false;
  }
  return /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

