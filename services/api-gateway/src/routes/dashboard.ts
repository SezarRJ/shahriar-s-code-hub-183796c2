import { Router, Request, Response } from 'express';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);

    const [projects, photos, points, overdue, snags, completion] = await Promise.all([
      client.query("SELECT COUNT(*) as count FROM projects WHERE status = 'active'"),
      client.query(`SELECT COUNT(*) as count FROM photos p JOIN capture_points cp ON cp.id = p.capture_point_id JOIN zones z ON z.id = cp.zone_id JOIN projects pr ON pr.id = z.project_id WHERE pr.status = 'active'`),
      client.query(`SELECT COUNT(*) as count FROM capture_points cp JOIN zones z ON z.id = cp.zone_id JOIN projects pr ON pr.id = z.project_id WHERE cp.is_active = true AND pr.status = 'active'`),
      client.query(`SELECT COUNT(*) as count FROM capture_points cp JOIN zones z ON z.id = cp.zone_id JOIN projects pr ON pr.id = z.project_id WHERE cp.is_active = true AND pr.status = 'active' AND ((SELECT MAX(p.captured_at) FROM photos p WHERE p.capture_point_id = cp.id) IS NULL OR (SELECT MAX(p.captured_at) FROM photos p WHERE p.capture_point_id = cp.id) < NOW() - (cp.capture_frequency_hours || ' hours')::interval)`),
      client.query(`SELECT COUNT(*) as count FROM snags s JOIN projects pr ON pr.id = s.project_id WHERE s.status = 'open' AND pr.status = 'active'`),
      client.query(`SELECT COUNT(*) as total, SUM(CASE WHEN latest_photo >= NOW() - (cp.capture_frequency_hours || ' hours')::interval THEN 1 ELSE 0 END) as completed FROM capture_points cp JOIN zones z ON z.id = cp.zone_id JOIN projects pr ON pr.id = z.project_id LEFT JOIN LATERAL (SELECT MAX(p.captured_at) as latest_photo FROM photos p WHERE p.capture_point_id = cp.id) latest ON true WHERE cp.is_active = true AND pr.status = 'active'`),
    ]);

    client.release();

    const total = parseInt(completion.rows[0].total, 10);
    const completed = parseInt(completion.rows[0].completed, 10);

    res.status(200).json({
      data: {
        active_projects: parseInt(projects.rows[0].count, 10),
        total_photos: parseInt(photos.rows[0].count, 10),
        total_capture_points: parseInt(points.rows[0].count, 10),
        overdue_points: parseInt(overdue.rows[0].count, 10),
        open_snags: parseInt(snags.rows[0].count, 10),
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error({ message: 'Dashboard summary error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

router.get('/projects', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);
    const result = await client.query(
      `SELECT pr.id, pr.name, pr.address, pr.status, pr.created_at, COUNT(DISTINCT cp.id) as capture_points, COUNT(DISTINCT p.id) as total_photos, COUNT(DISTINCT s.id) as open_snags
       FROM projects pr LEFT JOIN zones z ON z.project_id = pr.id LEFT JOIN capture_points cp ON cp.zone_id = z.id AND cp.is_active = true LEFT JOIN photos p ON p.capture_point_id = cp.id LEFT JOIN snags s ON s.project_id = pr.id AND s.status = 'open' GROUP BY pr.id ORDER BY pr.created_at DESC`
    );
    client.release();
    res.status(200).json({ data: result.rows });
  } catch (err) {
    logger.error({ message: 'Dashboard projects error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch dashboard projects' });
  }
});

export default router;
