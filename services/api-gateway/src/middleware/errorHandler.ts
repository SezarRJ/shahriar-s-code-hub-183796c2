import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({
    message: err.message,
    stack: err.stack,
    correlationId: req.correlationId,
    path: req.path,
    method: req.method,
  });

  const status = (err as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  res.status(status).json({
    error: message,
    correlationId: req.correlationId,
  });
}
