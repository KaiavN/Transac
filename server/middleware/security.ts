import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Rate limiting configuration
interface RateLimitRecord {
  count: number;
  firstRequest: number;
  blockedUntil?: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_REQUESTS = 60; // Maximum requests per window
const WINDOW_MS = 60 * 1000; // 1 minute window
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minute block

// CSRF token configuration
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Rate limiting middleware
export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Get or create rate limit record
  let record = rateLimitMap.get(clientIp) || {
    count: 0,
    firstRequest: now
  };

  // Check if client is blocked
  if (record.blockedUntil && now < record.blockedUntil) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((record.blockedUntil - now) / 1000)
    });
  }

  // Reset counter if window has expired
  if (now - record.firstRequest > WINDOW_MS) {
    record = {
      count: 0,
      firstRequest: now
    };
  }

  // Increment request count
  record.count++;

  // Block client if limit exceeded
  if (record.count > MAX_REQUESTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    rateLimitMap.set(clientIp, record);
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(BLOCK_DURATION_MS / 1000)
    });
  }

  rateLimitMap.set(clientIp, record);
  next();
};

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers[CSRF_HEADER_NAME] as string;
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];

  if (!token || !cookieToken || token !== cookieToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

// Generate and set CSRF token
export const setCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  const token = crypto.randomBytes(32).toString('hex');
  
  // Set CSRF cookie
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  // Expose token in response header for client-side access
  res.setHeader(CSRF_HEADER_NAME, token);
  next();
};

// Security headers middleware
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Set Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data: https:; " +
    "connect-src 'self' https:;"
  );

  next();
};