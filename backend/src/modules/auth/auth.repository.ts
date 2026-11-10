import db from '../../db/knex';

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  password_hash: string | null;
  role_id: string | null;
  role_name: string | null;
  is_active: boolean;
  permissions: string[];
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

/**
 * Find a user by email, joining their role name.
 * Permissions are loaded separately via findUserPermissions.
 */
export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const row = await db('users as u')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .whereRaw('LOWER(TRIM(u.email)) = ?', [email.toLowerCase().trim()])
    .select(
      'u.id',
      'u.name',
      'u.email',
      'u.password_hash',
      'u.role_id',
      'r.name as role_name',
      'u.is_active',
    )
    .first();

  if (!row) return undefined;

  const permissions = row.role_id ? await findUserPermissions(row.role_id) : [];
  return { ...row, permissions };
}

/**
 * Find a user by ID (used by /me endpoint).
 */
export async function findUserById(id: string): Promise<UserRow | undefined> {
  const row = await db('users as u')
    .leftJoin('roles as r', 'u.role_id', 'r.id')
    .where('u.id', id)
    .select(
      'u.id',
      'u.name',
      'u.email',
      'u.password_hash',
      'u.role_id',
      'r.name as role_name',
      'u.is_active',
    )
    .first();

  if (!row) return undefined;

  const permissions = row.role_id ? await findUserPermissions(row.role_id) : [];
  return { ...row, permissions };
}

/**
 * Returns all permission names for a given role.
 */
export async function findUserPermissions(roleId: string): Promise<string[]> {
  const rows = await db('role_permissions as rp')
    .join('permissions as p', 'rp.permission_id', 'p.id')
    .where('rp.role_id', roleId)
    .select('p.name');

  return rows.map((r: { name: string }) => r.name);
}

/**
 * Save a hashed refresh token for a user.
 */
export async function saveRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await db('refresh_tokens').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
}

/**
 * Find a valid (non-expired, non-revoked) refresh token by hash.
 */
export async function findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | undefined> {
  return db('refresh_tokens')
    .where({ token_hash: tokenHash })
    .whereNull('revoked_at')
    .where('expires_at', '>', new Date())
    .first();
}

/**
 * Revoke a specific refresh token.
 */
export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await db('refresh_tokens').where({ token_hash: tokenHash }).update({
    revoked_at: new Date(),
  });
}

/**
 * Revoke all active refresh tokens for a user (full logout).
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await db('refresh_tokens')
    .where({ user_id: userId })
    .whereNull('revoked_at')
    .update({ revoked_at: new Date() });
}

// ─── Password Reset Helpers ──────────────────────────────────────────

/**
 * Save a password reset token for a user.
 * Automatically clears previous unused tokens for that user.
 */
export async function savePasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await db('password_reset_tokens')
    .where({ user_id: userId })
    .whereNull('used_at')
    .delete();

  await db('password_reset_tokens').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
}

/**
 * Find a valid password reset token by hash.
 */
export async function findPasswordResetToken(
  tokenHash: string,
): Promise<PasswordResetTokenRow | undefined> {
  return db('password_reset_tokens')
    .where({ token_hash: tokenHash })
    .whereNull('used_at')
    .where('expires_at', '>', new Date())
    .first();
}

/**
 * Mark a password reset token as used.
 */
export async function markPasswordResetTokenUsed(tokenHash: string): Promise<void> {
  await db('password_reset_tokens')
    .where({ token_hash: tokenHash })
    .update({ used_at: new Date() });
}

/**
 * Update user's password hash.
 */
export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await db('users')
    .where({ id: userId })
    .update({
      password_hash: passwordHash,
      updated_at: new Date(),
    });
}
