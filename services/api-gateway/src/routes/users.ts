import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['tenant_admin', 'project_manager', 'site_supervisor', 'field_operator', 'read_only']),
  mfa_enabled: z.boolean().default(false),
  phone: z.string().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);

    const result = await client.query(
      'SELECT id, name, email, role, mfa_enabled, phone, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at DESC',
      [context.tenant_id]
    );
    client.release();

    res.status(200).json({ data: result.rows });
  } catch (err) {
    logger.error({ message: 'Fetch users error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const parsed = userSchema.parse(req.body);

    // Note: In production, this should create a Supabase Auth user first,
    // then link to the application user table. For local dev, we insert directly
    // assuming auth_id will be linked later.
    const client = await getClientWithContext(context);
    const result = await client.query(
      `INSERT INTO users (tenant_id, name, email, role, mfa_enabled, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, mfa_enabled, phone, is_active, created_at`,
      [context.tenant_id, parsed.name, parsed.email, parsed.role, parsed.mfa_enabled, parsed.phone || null]
    );
    client.release();

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error({ message: 'Create user error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);

    const result = await client.query(
      'SELECT id, name, email, role, mfa_enabled, phone, is_active, created_at FROM users WHERE id = $1',
      [context.user_id]
    );
    client.release();

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    logger.error({ message: 'Fetch profile error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
