import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../shared/errors';
import {
  findUserByEmail,
  findUserById,
  saveRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
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
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions,
  );
}

// ─── Service Methods ─────────────────────────────────────────────

/**
 * Login — verify credentials, issue access + refresh tokens.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await findUserByEmail(email);

  if (!user || !user.is_active) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const accessToken = buildAccessToken(user);

  // Refresh token = random UUID; store its hash
  const rawRefreshToken = crypto.randomUUID();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await saveRefreshToken(user.id, tokenHash, expiresAt);

  return {
    access_token: accessToken,
    refresh_token: rawRefreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role_name,
      permissions: user.permissions,
    },
  };
}

/**
 * Refresh — validate refresh token, issue new access token.
 * Does NOT rotate the refresh token to keep the UI simple.
 */
export async function refresh(rawRefreshToken: string): Promise<{ access_token: string }> {
  const tokenHash = hashToken(rawRefreshToken);
  const stored = await findRefreshToken(tokenHash);

  if (!stored) {
    throw new UnauthorizedError('Refresh token invalid or expired');
  }

  const user = await findUserById(stored.user_id);
  if (!user || !user.is_active) {
    throw new UnauthorizedError('User not found or inactive');
  }

  const accessToken = buildAccessToken(user);
  return { access_token: accessToken };
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
    email: user.email,
    role: user.role_name,
    permissions: user.permissions,
  };
}
