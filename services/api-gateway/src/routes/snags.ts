import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

const snagSchema = z.object({
  project_id: z.string().uuid(),
  photo_id: z.string().uuid().optional(),
  capture_point_id: z.string().uuid().optional(),
  category: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).default('open'),
  description: z.string().optional(),
  due_date: z.string().date().optional(),
  assigned_to: z.string().uuid().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const { project_id, status } = req.query;

    const client = await getClientWithContext(context);
    let query = 'SELECT * FROM snags WHERE 1=1';
    const params: any[] = [];

    if (project_id) {
      params.push(project_id);
      query += ` AND project_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await client.query(query, params);
    client.release();

    res.status(200).json({ data: result.rows });
  } catch (err) {
    logger.error({ message: 'Fetch snags error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch snags' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const parsed = snagSchema.parse(req.body);

    const client = await getClientWithContext(context);
    const result = await client.query(
      `INSERT INTO snags (project_id, photo_id, capture_point_id, category, severity, status, description, due_date, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        parsed.project_id,
        parsed.photo_id || null,
        parsed.capture_point_id || null,
        parsed.category,
        parsed.severity,
        parsed.status,
        parsed.description || null,
        parsed.due_date || null,
        parsed.assigned_to || null,
        context.user_id,
      ]
    );
    client.release();

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error({ message: 'Create snag error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to create snag' });
  }
});

export default router;
