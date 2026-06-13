import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const cid = req.headers['x-correlation-id'] as string || uuidv4();
  req.correlationId = cid;
  res.setHeader('x-correlation-id', cid);
  next();
}
