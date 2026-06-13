import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const { project_id, limit = '20', offset = '0' } = req.query;

    const client = await getClientWithContext(context);
    let query = 'SELECT * FROM reports WHERE 1=1';
    const params: any[] = [];

    if (project_id) {
      params.push(project_id);
      query += ` AND project_id = $${params.length}`;
    }

    params.push(parseInt(limit as string, 10));
    query += ` ORDER BY generated_at DESC LIMIT $${params.length}`;

    params.push(parseInt(offset as string, 10));
    query += ` OFFSET $${params.length}`;

    const result = await client.query(query, params);
    client.release();

    res.status(200).json({ data: result.rows });
  } catch (err) {
    logger.error({ message: 'Fetch reports error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const parsed = z.object({
      project_id: z.string().uuid(),
      period_start: z.string().date().optional(),
      period_end: z.string().date().optional(),
    }).parse(req.body);

    // In production: queue report generation in Redis for report-service
    // For now, return accepted status
    logger.info({
      message: 'Report generation triggered',
      projectId: parsed.project_id,
      triggeredBy: context.user_id,
      correlationId: req.correlationId,
    });

    res.status(202).json({
      message: 'Report generation queued',
      project_id: parsed.project_id,
      status: 'pending',
    });
  } catch (err) {
    logger.error({ message: 'Trigger report error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to trigger report' });
  }
});

export default router;
