import { Request, Response, NextFunction } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: { error: string };
  standardHeaders?: boolean;
}

/**
 * High-performance sliding-window in-memory Rate Limiter.
 * Adheres to RFC 6585 (HTTP 429 Too Many Requests) and Draft-7 RateLimit standard headers.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = { error: 'Too many requests, please try again later.' }
  } = options;

  const hits = new Map<string, { count: number; resetTime: number }>();

  // Periodic cleanup of expired window entries
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of hits.entries()) {
      if (now > value.resetTime) {
        hits.delete(key);
      }
    }
  }, Math.min(windowMs, 60000)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    let record = hits.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    // Standard Draft-7 RateLimit headers
    res.setHeader('RateLimit-Limit', max.toString());
    res.setHeader('RateLimit-Remaining', remaining.toString());
    res.setHeader('RateLimit-Reset', resetSeconds.toString());

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds.toString());
      return res.status(429).json(message);
    }

    next();
  };
}

/**
 * Auth Rate Limiter: 100 requests per 15 minutes
 * Protects credential and authentication endpoints (/api/auth/*) from brute-force attacks.
 */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.' }
});

/**
 * Presigned URL Rate Limiter: 50 requests per 15 minutes
 * Protects Cloudflare R2 presigned upload URL generation (/api/media/presigned-url) from quota depletion.
 */
export const presignLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many presigned URL requests from this IP. Please try again after 15 minutes.' }
});
