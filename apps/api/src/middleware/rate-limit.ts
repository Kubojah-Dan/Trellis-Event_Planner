import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

export function resetRateLimits() {
  rateLimitMap.clear();
}

/**
 * In-memory sliding window rate limiter per actor UID, auth token, or IP.
 * Protects against denial-of-service and AI quota exhaustion.
 */
export function createRateLimiter(options: { maxRequests: number; windowMs: number }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const key = req.actor?.uid || (authHeader ? `auth:${authHeader.slice(-20)}` : null) || req.ip || 'anonymous';
    const now = Date.now();

    const record = rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      return next();
    }

    if (record.count >= options.maxRequests) {
      next(
        new AppError(
          429,
          'RATE_LIMIT_EXCEEDED',
          `Too many requests. Please wait ${Math.ceil((record.resetTime - now) / 1000)} seconds before retrying.`
        )
      );
      return;
    }

    record.count++;
    next();
  };
}
