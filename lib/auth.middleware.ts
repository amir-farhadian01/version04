import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from './jwt.js';
import { isTokenBlacklisted } from './tokenBlacklist.js';
import prisma from './db.js';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  let decoded: JwtPayload;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    // Re-validate the user's role against the database. Never trust the JWT
    // role claim alone — a forged or stale token could otherwise escalate privileges.
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true },
    });
    if (!dbUser) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    req.user = { ...decoded, role: dbUser.role };
  } catch {
    res.status(401).json({ error: 'Authentication failed' });
    return;
  }

  // Check if the token has been blacklisted (logged out). isTokenBlacklisted
  // swallows Redis errors internally, so this is safe even if Redis is down.
  const blacklisted = await isTokenBlacklisted(token);
  if (blacklisted) {
    res.status(401).json({ code: 'TOKEN_BLACKLISTED', message: 'Token has been invalidated' });
    return;
  }

  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

export const isAdmin = requireRole('owner', 'platform_admin', 'support', 'finance');
