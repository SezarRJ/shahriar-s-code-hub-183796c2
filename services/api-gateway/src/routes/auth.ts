import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:9999';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  tenant_id: z.string().uuid().optional(),
  role: z.enum(['tenant_admin', 'project_manager', 'site_supervisor', 'field_operator', 'read_only']).optional(),
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) {
      logger.warn({ message: 'Login failed', email: parsed.email, error: error.message });
      res.status(401).json({ error: error.message });
      return;
    }

    res.status(200).json({
      token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      user: data.user,
    });
  } catch (err) {
    logger.error({ message: 'Login error', error: (err as Error).message });
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.parse(req.body);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: parsed.email,
      password: parsed.password,
    });

    if (authError || !authData.user) {
      res.status(400).json({ error: authError?.message || 'Auth signup failed' });
      return;
    }

    // Create application user record linked to auth
    const { error: dbError } = await supabase
      .from('users')
      .insert({
        auth_id: authData.user.id,
        email: parsed.email,
        name: parsed.name,
        role: parsed.role || 'field_operator',
        tenant_id: parsed.tenant_id,
      });

    if (dbError) {
      logger.error({ message: 'User DB insert failed', error: dbError.message });
      res.status(500).json({ error: 'User created but profile insert failed' });
      return;
    }

    res.status(201).json({ message: 'User created successfully', user_id: authData.user.id });
  } catch (err) {
    logger.error({ message: 'Signup error', error: (err as Error).message });
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/logout', async (_req: Request, res: Response) => {
  // Client-side token removal; Supabase handles session invalidation via refresh token rotation
  res.status(200).json({ message: 'Logout successful' });
});

export default router;
