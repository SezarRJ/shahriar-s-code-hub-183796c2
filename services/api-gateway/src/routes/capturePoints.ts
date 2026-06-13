import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

const capturePointSchema = z.object({
  zone_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  expected_stage: z.string().optional(),
  capture_frequency_hours: z.number().int().min(1).default(24),
  gps_lat: z.number().min(-90).max(90).optional(),
  gps_lng: z.number().min(-180).max(180).optional(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const { zone_id, is_active = 'true' } = req.query;

    const client = await getClientWithContext(context);
    let query = 'SELECT * FROM capture_points WHERE 1=1';
    const params: any[] = [];

    if (zone_id) {
      params.push(zone_id);
      query += ` AND zone_id = $${params.length}`;
    }

    if (is_active !== 'all') {
      params.push(is_active === 'true');
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY name';

    const result = await client.query(query, params);
    client.release();

    res.status(200).json({ data: result.rows });
  } catch (err) {
    logger.error({ message: 'Fetch capture points error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch capture points' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const parsed = capturePointSchema.parse(req.body);

    const client = await getClientWithContext(context);
    const result = await client.query(
      `INSERT INTO capture_points (zone_id, name, description, expected_stage, capture_frequency_hours, gps_lat, gps_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        parsed.zone_id,
        parsed.name,
        parsed.description || null,
        parsed.expected_stage || null,
        parsed.capture_frequency_hours,
        parsed.gps_lat || null,
        parsed.gps_lng || null,
      ]
    );
    client.release();

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error({ message: 'Create capture point error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to create capture point' });
  }
});

export default router;
