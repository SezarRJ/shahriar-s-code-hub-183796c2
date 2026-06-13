import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Tenant-aware sliding window rate limiter using Redis.
 *
 * SRS Requirements:
 * - NFR-1.5: API response time P95 < 500ms (excludes uploads)
 * - NFR-4.1: 100 concurrent projects Year 1, 1,000 Year 2
 * - Security: Prevent single tenant from overwhelming the system
 *
 * Limits:
 * - Per user: 100 requests / 60 seconds (rolling window)
 * - Per tenant: 1,000 requests / 60 seconds (rolling window)
 * - Per tenant burst: 2,000 requests / 60 seconds (with 429 soft warning)
 */

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface RateLimitConfig {
  userMax: number;    // requests per window per user
  tenantMax: number;   // requests per window per tenant
  tenantSoft: number;  // soft warning threshold per tenant
  windowSeconds: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  userMax: 100,
  tenantMax: 1000,
  tenantSoft: 2000,
  windowSeconds: 60,
};

/**
 * Sliding window rate limit using Redis sorted sets (ZADD + ZREMRANGEBYSCORE).
 * This is more accurate than fixed windows and prevents stampeding at window boundaries.
 */
export async function tenantRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const config = (req as any).rateLimitConfig || DEFAULT_CONFIG;
    const now = Date.now();
    const windowStart = now - (config.windowSeconds * 1000);

    // Extract identifiers from authenticated request
    const userId = req.user?.id || req.ip || 'anonymous';
    const tenantId = (req as any).tenantContext?.tenant_id || 'unknown';

    // Redis keys
    const userKey = `ratelimit:user:${userId}`;
    const tenantKey = `ratelimit:tenant:${tenantId}`;
    const correlationId = req.correlationId || 'unknown';

    // Use Redis pipeline for atomicity
    const pipeline = redis.pipeline();

    // Remove entries outside the sliding window
    pipeline.zremrangebyscore(userKey, 0, windowStart);
    pipeline.zremrangebyscore(tenantKey, 0, windowStart);

    // Add current request with score = timestamp
    pipeline.zadd(userKey, now, `${now}-${correlationId}`);
    pipeline.zadd(tenantKey, now, `${now}-${correlationId}`);

    // Set expiry on the keys (slightly longer than window to handle edge cases)
    pipeline.expire(userKey, config.windowSeconds + 10);
    pipeline.expire(tenantKey, config.windowSeconds + 10);

    // Count current window entries
    pipeline.zcard(userKey);
    pipeline.zcard(tenantKey);

    const results = await pipeline.exec();
    if (!results) {
      logger.warn({ message: 'Rate limiter pipeline failed', correlationId });
      next();
      return;
    }

    // Results indices: [zrem user, zrem tenant, zadd user, zadd tenant, expire user, expire tenant, zcard user, zcard tenant]
    const userCount = (results[6][1] as number) || 0;
    const tenantCount = (results[7][1] as number) || 0;

    // Check tenant soft limit (warning header, but still allow)
    if (tenantCount > config.tenantSoft) {
      res.setHeader('X-RateLimit-Tenant-Warning', 'tenant approaching burst limit');
      logger.warn({
        message: 'Tenant rate limit soft warning',
        tenantId,
        tenantCount,
        limit: config.tenantSoft,
        correlationId,
      });
    }

    // Check tenant hard limit
    if (tenantCount > config.tenantMax) {
      res.setHeader('Retry-After', String(config.windowSeconds));
      res.setHeader('X-RateLimit-Tenant-Limit', String(config.tenantMax));
      res.setHeader('X-RateLimit-Tenant-Remaining', '0');
      res.setHeader('X-RateLimit-Tenant-Reset', String(Math.ceil((now + config.windowSeconds * 1000) / 1000)));

      logger.warn({
        message: 'Tenant rate limit exceeded',
        tenantId,
        tenantCount,
        limit: config.tenantMax,
        correlationId,
      });

      res.status(429).json({
        error: 'Too many requests for this organization. Please try again later.',
        code: 'TENANT_RATE_LIMITED',
        retryAfter: config.windowSeconds,
      });
      return;
    }

    // Check user hard limit
    if (userCount > config.userMax) {
      res.setHeader('Retry-After', String(config.windowSeconds));
      res.setHeader('X-RateLimit-User-Limit', String(config.userMax));
      res.setHeader('X-RateLimit-User-Remaining', '0');
      res.setHeader('X-RateLimit-User-Reset', String(Math.ceil((now + config.windowSeconds * 1000) / 1000)));

      logger.warn({
        message: 'User rate limit exceeded',
        userId,
        userCount,
        limit: config.userMax,
        correlationId,
      });

      res.status(429).json({
        error: 'Too many requests for this user. Please try again later.',
        code: 'USER_RATE_LIMITED',
        retryAfter: config.windowSeconds,
      });
      return;
    }

    // Set rate limit headers for successful requests
    res.setHeader('X-RateLimit-User-Limit', String(config.userMax));
    res.setHeader('X-RateLimit-User-Remaining', String(Math.max(0, config.userMax - userCount)));
    res.setHeader('X-RateLimit-Tenant-Limit', String(config.tenantMax));
    res.setHeader('X-RateLimit-Tenant-Remaining', String(Math.max(0, config.tenantMax - tenantCount)));

    next();
  } catch (err) {
    logger.error({ message: 'Rate limiter error', error: (err as Error).message, correlationId: req.correlationId });
    // Fail open: allow request if rate limiter is broken
    next();
  }
}

/**
 * Higher rate limit for authenticated API calls (e.g., dashboard queries)
 * vs. upload endpoints (which are naturally slower).
 */
export function createRateLimitMiddleware(config: Partial<RateLimitConfig>) {
  return (req: Request, res: Response, next: NextFunction) => {
    (req as any).rateLimitConfig = { ...DEFAULT_CONFIG, ...config };
    tenantRateLimiter(req, res, next);
  };
}

/**
 * Stricter limits for upload endpoints (photos are large and slow).
 * Target: 1,000 requests / 60 seconds per tenant, 10 uploads / 60 seconds per user.
 */
export const uploadRateLimit = createRateLimitMiddleware({
  userMax: 10,
  tenantMax: 500,
  tenantSoft: 1000,
  windowSeconds: 60,
});

/**
 * Standard limits for data queries (fast, lightweight).
 * Target: 100 requests / 60 seconds per user, 1,000 / 60 seconds per tenant.
 */
export const standardRateLimit = createRateLimitMiddleware({
  userMax: 100,
  tenantMax: 1000,
  tenantSoft: 2000,
  windowSeconds: 60,
});

/**
 * Generous limits for auth endpoints (login, refresh, etc.)
 * but still protected against brute force.
 */
export const authRateLimit = createRateLimitMiddleware({
  userMax: 20,
  tenantMax: 200,
  tenantSoft: 500,
  windowSeconds: 60,
});
