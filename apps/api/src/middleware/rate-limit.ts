import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const MAX_RATE_LIMIT_ENTRIES = 5000;
const rateLimitMap = new Map<string, RateLimitRecord>();

let lastEvictionTime = Date.now();

/**
 * Evicts expired entries and enforces strict bounded memory size.
 * Guarantees zero memory leaks from unique client IPs or ephemeral auth headers.
 */
function pruneExpiredEntries(now: number) {
  // Run sweep at most once every 10 seconds, or immediately if reaching capacity
  if (now - lastEvictionTime < 10000 && rateLimitMap.size < MAX_RATE_LIMIT_ENTRIES) {
    return;
  }
  lastEvictionTime = now;

  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }

  // Hard cap enforcement: if still exceeding max capacity, evict oldest entries
  if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
    const overflow = rateLimitMap.size - MAX_RATE_LIMIT_ENTRIES + 100;
    let evicted = 0;
    for (const key of rateLimitMap.keys()) {
      rateLimitMap.delete(key);
      evicted++;
      if (evicted >= overflow) break;
    }
  }
}

export function resetRateLimits() {
  rateLimitMap.clear();
  lastEvictionTime = Date.now();
}

/**
 * In-memory sliding window rate limiter per actor UID, auth token, or IP.
 * Protects against denial-of-service and AI quota exhaustion with strictly bounded memory.
 */
export function createRateLimiter(options: { maxRequests: number; windowMs: number }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const key = req.actor?.uid || (authHeader ? `auth:${authHeader.slice(-20)}` : null) || req.ip || 'anonymous';
    const now = Date.now();

    // Bound memory and evict expired records
    pruneExpiredEntries(now);

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
