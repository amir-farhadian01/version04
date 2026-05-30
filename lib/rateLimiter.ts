// ---------------------------------------------------------------------------
// Rate Limiters
// Centralised rate-limit configuration for the Neighborly API.
// ---------------------------------------------------------------------------
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { publish } from './bus.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return true when running in a test environment so rate-limit middleware
 * does not interfere with test suites.
 */
function skipInTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

// ---------------------------------------------------------------------------
// Limiters
// ---------------------------------------------------------------------------

/**
 * Auth endpoints — strict limit to prevent brute-force attacks.
 * 10 requests per minute per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 60_000,          // 1 minute
  max: 10,
  standardHeaders: true,     // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,      // Disable `X-RateLimit-*` headers
  skip: skipInTest,
  handler: (req: Request, res) => {
    void publish('rate_limit.hit', {
      type: 'auth',
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    });
  },
});

/**
 * General API endpoints — moderate limit.
 * 60 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (req: Request, res) => {
    void publish('rate_limit.hit', {
      type: 'api',
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.',
    });
  },
});

/**
 * File upload endpoints — prevent upload abuse.
 * 10 requests per minute per IP.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (req: Request, res) => {
    void publish('rate_limit.hit', {
      type: 'upload',
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many upload requests. Please try again later.',
    });
  },
});

/**
 * Admin API endpoints — moderate limit.
 * 30 requests per minute per IP.
 */
export const adminLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (req: Request, res) => {
    void publish('rate_limit.hit', {
      type: 'admin',
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.',
    });
  },
});