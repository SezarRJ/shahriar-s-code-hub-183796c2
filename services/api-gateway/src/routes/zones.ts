import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

const zoneSchema = z.object({
  project_id: z.string().uuid(),
  parent_zone_id: z.string().uuid().optional(),
  name: z.string().min(1),
  level_type: z.string().min(1), // e.g., 'project', 'floor', 'room'
  level_number: z.number().int().optional(),
  sort_order: z.number().int().default(0),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const { project_id } = req.query;

    const client = await getClientWithContext(context);
    let query = 'SELECT * FROM zones WHERE 1=1';
    const params: any[] = [];

    if (project_id) {
      params.push(project_id);
      query += ` AND project_id = $${params.length}`;
    }

    query += ' ORDER BY sort_order, level_number, name';

    const result = await client.query(query, params);
    client.release();

    res.status(200).json({ data: result.rows });
  } catch (err) {
    logger.error({ message: 'Fetch zones error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const parsed = zoneSchema.parse(req.body);

    const client = await getClientWithContext(context);
    const result = await client.query(
      `INSERT INTO zones (project_id, parent_zone_id, name, level_type, level_number, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        parsed.project_id,
        parsed.parent_zone_id || null,
        parsed.name,
        parsed.level_type,
        parsed.level_number || null,
        parsed.sort_order,
      ]
    );
    client.release();

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error({ message: 'Create zone error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to create zone' });
  }
});

export default router;
