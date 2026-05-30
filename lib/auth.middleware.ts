import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from './jwt.js';
import { isTokenBlacklisted } from './tokenBlacklist.js';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    // Check if token has been blacklisted (logged out)
    isTokenBlacklisted(token).then(blacklisted => {
      if (blacklisted) {
        res.status(401).json({ code: 'TOKEN_BLACKLISTED', message: 'Token has been invalidated' });
        return;
      }
      next();
    }).catch(() => {
      // If blacklist check fails, allow the request through (fail open)
      next();
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
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
