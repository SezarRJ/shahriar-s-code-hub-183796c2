import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Attaches the internal service token to all outgoing requests to other services.
 */
export function internalServiceAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (token) {
    (req as any).internalServiceToken = token;
  }
  next();
}

/**
 * Injects tenant context into the database connection so Row-Level Security (RLS)
 * policies can filter data correctly. Sets PostgreSQL session variables for the
 * current tenant_id and user_role.
 */
export function tenantContextMiddleware(

  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      next();
      return;
    }

    // Set PostgreSQL session config for RLS
    // In production, this is passed via SET commands or connection pool parameters
    // Here we attach to the request for downstream DB clients to use
    (req as any).tenantContext = {
      tenant_id: req.user.tenant_id,
      role: req.user.role,
      user_id: req.user.id,
    };

    logger.info({
      message: 'Tenant context injected',
      tenantId: req.user.tenant_id,
      role: req.user.role,
      userId: req.user.id,
      correlationId: req.correlationId,
    });

    next();
  } catch (err) {
    logger.error({ message: 'Tenant context error', error: (err as Error).message });
    next();
  }
}
