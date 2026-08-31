import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Unit tests for auth service helpers.
 * These test pure logic without a DB connection.
 */
describe('Auth — password hashing', () => {
  it('should hash a password and verify it', async () => {
    const plain = 'MySecret@99';
    const hash = await bcrypt.hash(plain, 10);
    expect(hash).not.toBe(plain);
    const match = await bcrypt.compare(plain, hash);
    expect(match).toBe(true);
  });

  it('should reject a wrong password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    const match = await bcrypt.compare('wrong', hash);
    expect(match).toBe(false);
  });
});

describe('Auth — JWT structure', () => {
  const secret = 'test_secret_at_least_16chars';

  it('should sign and verify a JWT with the expected claims', () => {
    const payload = {
      sub: 'user-uuid-123',
      name: 'Test User',
      email: 'test@example.com',
      roleId: 'role-uuid',
      roleName: 'Owner',
      permissions: ['customers:read', 'sales:write'],
    };

    const token = jwt.sign(payload, secret, { expiresIn: '15m' });
    const decoded = jwt.verify(token, secret) as typeof payload & { sub: string };

    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.roleName).toBe('Owner');
    expect(decoded.permissions).toContain('customers:read');
  });

  it('should reject an expired JWT', () => {
    const token = jwt.sign({ sub: 'x' }, secret, { expiresIn: '-1s' });
    expect(() => jwt.verify(token, secret)).toThrow();
  });

  it('should reject a JWT signed with a different secret', () => {
    const token = jwt.sign({ sub: 'x' }, 'other_secret');
    expect(() => jwt.verify(token, secret)).toThrow();
  });
});

describe('Auth — token hash', () => {
  it('should produce a consistent SHA-256 hash', () => {
    const raw = crypto.randomUUID();
    const hash1 = crypto.createHash('sha256').update(raw).digest('hex');
    const hash2 = crypto.createHash('sha256').update(raw).digest('hex');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('should produce different hashes for different tokens', () => {
    const h1 = crypto.createHash('sha256').update('token-a').digest('hex');
    const h2 = crypto.createHash('sha256').update('token-b').digest('hex');
    expect(h1).not.toBe(h2);
  });
});
