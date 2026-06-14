import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

const projectSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  gps_boundary: z.string().optional(), // GeoJSON string
  status: z.enum(['active', 'paused', 'completed']).default('active'),
  baseline_schedule: z.any().optional(),
  alert_delay_threshold_days: z.number().int().min(0).default(1),
  alert_critical_delay_threshold_days: z.number().int().min(0).default(3),
  capture_frequency_hours: z.number().int().min(1).default(24),
  report_language: z.enum(['ar', 'en']).default('ar'),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);

    const result = await client.query('SELECT * FROM projects ORDER BY created_at DESC');
    client.release();

    res.status(200).json({ data: result.rows });
  } catch (err) {
    logger.error({ message: 'Fetch projects error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const parsed = projectSchema.parse(req.body);

    const client = await getClientWithContext(context);
    const result = await client.query(
      `INSERT INTO projects (tenant_id, name, address, gps_boundary, status, baseline_schedule,
        alert_delay_threshold_days, alert_critical_delay_threshold_days, capture_frequency_hours, report_language, created_by)
       VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        context.tenant_id,
        parsed.name,
        parsed.address || null,
        parsed.gps_boundary || null,
        parsed.status,
        parsed.baseline_schedule ? JSON.stringify(parsed.baseline_schedule) : null,
        parsed.alert_delay_threshold_days,
        parsed.alert_critical_delay_threshold_days,
        parsed.capture_frequency_hours,
        parsed.report_language,
        context.user_id,
      ]
    );
    client.release();

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error({ message: 'Create project error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);

    const result = await client.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    client.release();

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    logger.error({ message: 'Fetch project error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const parsed = projectSchema.partial().parse(req.body);

    const client = await getClientWithContext(context);
    const result = await client.query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        address = COALESCE($2, address),
        status = COALESCE($3, status),
        baseline_schedule = COALESCE($4, baseline_schedule),
        alert_delay_threshold_days = COALESCE($5, alert_delay_threshold_days),
        alert_critical_delay_threshold_days = COALESCE($6, alert_critical_delay_threshold_days),
        capture_frequency_hours = COALESCE($7, capture_frequency_hours),
        report_language = COALESCE($8, report_language)
       WHERE id = $9
       RETURNING *`,
      [
        parsed.name || null,
        parsed.address || null,
        parsed.status || null,
        parsed.baseline_schedule ? JSON.stringify(parsed.baseline_schedule) : null,
        parsed.alert_delay_threshold_days || null,
        parsed.alert_critical_delay_threshold_days || null,
        parsed.capture_frequency_hours || null,
        parsed.report_language || null,
        req.params.id,
      ]
    );
    client.release();

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    logger.error({ message: 'Update project error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to update project' });
  }
});

export default router;
