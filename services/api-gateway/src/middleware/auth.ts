import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      supabase?: SupabaseClient;
      user?: {
        id: string;
        email: string;
        role: string;
        tenant_id: string;
        auth_id: string;
      };
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:9999';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Create Supabase client with service role for server-side verification
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: authUser }, error } = await supabase.auth.getUser(token);

    if (error || !authUser) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Fetch application user with role and tenant
    const { data: appUser, error: appError } = await supabase
      .from('users')
      .select('id, role, tenant_id, name')
      .eq('auth_id', authUser.id)
      .single();

    if (appError || !appUser) {
      res.status(401).json({ error: 'User not found in application database' });
      return;
    }

    req.user = {
      id: appUser.id,
      email: authUser.email || '',
      role: appUser.role,
      tenant_id: appUser.tenant_id,
      auth_id: authUser.id,
    };
    req.supabase = supabase;

    next();
  } catch (err) {
    logger.error({ message: 'Auth middleware error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Authentication error' });
  }
}
