import jwt from 'jsonwebtoken';

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';
const INSECURE_SECRETS = new Set([
  'dev-access-secret-change-in-prod',
  'dev-refresh-secret-change-in-prod',
  'dev-secret-local',
  'replace-this-in-production',
  'change_me',
  'change-me',
]);

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  username?: string;
}

export function getJwtSecrets(): { accessSecret: string; refreshSecret: string } {
  const accessSecret = process.env.JWT_SECRET?.trim();
  const refreshSecret = process.env.JWT_REFRESH_SECRET?.trim();

  if (!accessSecret || INSECURE_SECRETS.has(accessSecret)) {
    throw new Error('JWT_SECRET is missing or insecure');
  }
  if (!refreshSecret || INSECURE_SECRETS.has(refreshSecret)) {
    throw new Error('JWT_REFRESH_SECRET is missing or insecure');
  }
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  return { accessSecret, refreshSecret };
}

export function validateJwtSecrets(): void {
  getJwtSecrets();
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecrets().accessSecret, { expiresIn: ACCESS_EXPIRY });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecrets().refreshSecret, { expiresIn: REFRESH_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecrets().accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecrets().refreshSecret) as JwtPayload;
}

export function generateTokenPair(payload: JwtPayload) {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}
