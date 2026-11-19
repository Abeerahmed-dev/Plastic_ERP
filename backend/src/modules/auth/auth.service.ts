import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { ValidationError, UnauthorizedError } from '../../shared/errors';
import { isValidPassword } from '../../shared/password.schema';
import { sendPasswordResetEmail } from '../../services/mail.service';
import {
  findUserByEmail,
  findUserById,
  saveRefreshToken,
  findRefreshToken,
  findAnyRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  savePasswordResetToken,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUserPassword,
} from './auth.repository';

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export interface MeResult {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildAccessToken(user: {
  id: string;
  name: string;
  email: string;
  role_id: string;
  role_name: string;
  permissions: string[];
}): string {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      roleId: user.role_id,
      roleName: user.role_name,
      permissions: user.permissions,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN, algorithm: 'HS256' } as jwt.SignOptions,
  );
}

// ─── Service Methods ─────────────────────────────────────────────

/**
 * Login — verify credentials, issue access + refresh tokens.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await findUserByEmail(email);

  if (!user || !user.is_active || !user.password_hash || !user.email || !user.role_id || !user.role_name) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const validUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
    permissions: user.permissions,
  };

  const accessToken = buildAccessToken(validUser);

  // Refresh token = random UUID; store its hash
  const rawRefreshToken = crypto.randomUUID();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await saveRefreshToken(user.id, tokenHash, expiresAt);

  return {
    access_token: accessToken,
    refresh_token: rawRefreshToken,
    user: {
      id: validUser.id,
      name: validUser.name,
      email: validUser.email,
      role: validUser.role_name,
      permissions: validUser.permissions,
    },
  };
}

export interface RefreshResult {
  access_token: string;
  refresh_token: string;
}

/**
 * Refresh — validate refresh token, issue new access token, and rotate refresh token.
 * Complies with OAuth 2.0 / RFC 6749 Refresh Token Rotation (RTR) & Reuse Detection.
 */
export async function refresh(rawRefreshToken: string): Promise<RefreshResult> {
  const tokenHash = hashToken(rawRefreshToken);
  const stored = await findRefreshToken(tokenHash);

  if (!stored) {
    // Check if an already-revoked token is being reused (Token Theft / Replay Attack)
    const compromised = await findAnyRefreshToken(tokenHash);
    if (compromised) {
      // Replay Detection: Revoke all sessions for this user immediately
      await revokeAllUserRefreshTokens(compromised.user_id);
    }
    throw new UnauthorizedError('Refresh token invalid or expired');
  }

  const user = await findUserById(stored.user_id);
  if (!user || !user.is_active || !user.email || !user.role_id || !user.role_name) {
    throw new UnauthorizedError('User not found or inactive');
  }

  // 1. Immediately revoke the consumed refresh token
  await revokeRefreshToken(tokenHash);

  // 2. Issue a brand new rotated refresh token
  const newRawRefreshToken = crypto.randomUUID();
  const newTokenHash = hashToken(newRawRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await saveRefreshToken(user.id, newTokenHash, expiresAt);

  // 3. Issue new access token
  const validUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
    permissions: user.permissions,
  };

  const accessToken = buildAccessToken(validUser);

  return {
    access_token: accessToken,
    refresh_token: newRawRefreshToken,
  };
}

/**
 * Logout — revoke the provided refresh token (or all tokens for the user).
 */
export async function logout(
  userId: string,
  rawRefreshToken?: string,
): Promise<void> {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await revokeRefreshToken(tokenHash);
  } else {
    await revokeAllUserRefreshTokens(userId);
  }
}

/**
 * Me — return current user profile from DB (fresh permissions).
 */
export async function getMe(userId: string): Promise<MeResult> {
  const user = await findUserById(userId);
  if (!user || !user.is_active) {
    throw new UnauthorizedError('User not found or inactive');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email || '',
    role: user.role_name || '',
    permissions: user.permissions,
  };
}

/**
 * Forgot Password — generate a secure reset token and send reset email.
 */
export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await findUserByEmail(normalizedEmail);

  const genericMessage = 'If your email is registered in our system, a password reset link has been sent. Please check your inbox.';

  if (!user || !user.is_active || !user.email) {
    return {
      success: true,
      message: genericMessage,
    };
  }

  // Generate 64-char hex random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await savePasswordResetToken(user.id, tokenHash, expiresAt);

  const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl, user.name);

  return {
    success: true,
    message: genericMessage,
  };
}

/**
 * Reset Password — verify reset token and update user's password.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  if (!token?.trim()) {
    throw new ValidationError('Password reset token is required');
  }

  if (!newPassword || !isValidPassword(newPassword)) {
    throw new ValidationError('New password must be at least 8 characters and contain at least one letter and one number');
  }

  const tokenHash = hashToken(token.trim());
  const tokenRecord = await findPasswordResetToken(tokenHash);

  if (!tokenRecord) {
    throw new ValidationError('Invalid or expired password reset link. Please request a new one.');
  }

  // Hash new password with bcrypt
  const saltRounds = 10;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password in DB
  await updateUserPassword(tokenRecord.user_id, newPasswordHash);

  // Invalidate this reset token
  await markPasswordResetTokenUsed(tokenHash);

  // Revoke all existing sessions/refresh tokens for security
  await revokeAllUserRefreshTokens(tokenRecord.user_id);

  return {
    success: true,
    message: 'Your password has been reset successfully. You can now login with your new password.',
  };
}
