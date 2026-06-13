import { Router, Request, Response } from 'express';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/dashboard/summary
 * Aggregate KPIs for the authenticated user's tenant and projects.
 * Used by the web dashboard for real-time KPI cards (FR-4.7).
 *
 * KPIs:
 * - active_projects: count of active projects
 * - total_photos: count of all photos in tenant
 * - total_capture_points: count of active capture points
 * - overdue_points: count of points with no photo in configured frequency window
 * - open_snags: count of open snags across all projects
 * - completion_rate: percentage of capture points with recent photos
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);

    // 1. Active projects count
    const projectsResult = await client.query(
      "SELECT COUNT(*) as count FROM projects WHERE status = 'active'"
    );
    const activeProjects = parseInt(projectsResult.rows[0].count, 10);

    // 2. Total photos
    const photosResult = await client.query(
      `SELECT COUNT(*) as count FROM photos p
       JOIN capture_points cp ON cp.id = p.capture_point_id
       JOIN zones z ON z.id = cp.zone_id
       JOIN projects pr ON pr.id = z.project_id
       WHERE pr.status = 'active'`
    );
    const totalPhotos = parseInt(photosResult.rows[0].count, 10);

    // 3. Total active capture points
    const pointsResult = await client.query(
      `SELECT COUNT(*) as count FROM capture_points cp
       JOIN zones z ON z.id = cp.zone_id
       JOIN projects pr ON pr.id = z.project_id
       WHERE cp.is_active = true AND pr.status = 'active'`
    );
    const totalCapturePoints = parseInt(pointsResult.rows[0].count, 10);

    // 4. Overdue capture points (no photo in frequency window)
    const overdueResult = await client.query(
      `SELECT COUNT(*) as count FROM capture_points cp
       JOIN zones z ON z.id = cp.zone_id
       JOIN projects pr ON pr.id = z.project_id
       WHERE cp.is_active = true AND pr.status = 'active'
         AND (SELECT MAX(p.captured_at) FROM photos p WHERE p.capture_point_id = cp.id) IS NULL
          OR (SELECT MAX(p.captured_at) FROM photos p WHERE p.capture_point_id = cp.id) < NOW() - (cp.capture_frequency_hours || ' hours')::interval`
    );
    const overduePoints = parseInt(overdueResult.rows[0].count, 10);

    // 5. Open snags
    const snagsResult = await client.query(
      `SELECT COUNT(*) as count FROM snags s
       JOIN projects pr ON pr.id = s.project_id
       WHERE s.status = 'open' AND pr.status = 'active'`
    );
    const openSnags = parseInt(snagsResult.rows[0].count, 10);

    // 6. Completion rate: points with a photo in the last frequency window
    const completionResult = await client.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN latest_photo >= NOW() - (cp.capture_frequency_hours || ' hours')::interval THEN 1 ELSE 0 END) as completed
       FROM capture_points cp
       JOIN zones z ON z.id = cp.zone_id
       JOIN projects pr ON pr.id = z.project_id
       LEFT JOIN LATERAL (
         SELECT MAX(p.captured_at) as latest_photo
         FROM photos p
         WHERE p.capture_point_id = cp.id
       ) latest ON true
       WHERE cp.is_active = true AND pr.status = 'active'`
    );
    const total = parseInt(completionResult.rows[0].total, 10);
    const completed = parseInt(completionResult.rows[0].completed, 10);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    client.release();

    res.status(200).json({
      data: {
        active_projects: activeProjects,
        total_photos: totalPhotos,
        total_capture_points: totalCapturePoints,
        overdue_points: overduePoints,
        open_snags: openSnags,
        completion_rate: completionRate,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error({ message: 'Dashboard summary error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

/**
 * GET /api/v1/dashboard/projects
 * List of projects with summary statistics for each.
 */
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);

    const result = await client.query(
      `SELECT
        pr.id,
        pr.name,
        pr.address,
        pr.status,
        pr.created_at,
        COUNT(DISTINCT cp.id) as capture_points,
        COUNT(DISTINCT p.id) as total_photos,
        COUNT(DISTINCT s.id) as open_snags
       FROM projects pr
       LEFT JOIN zones z ON z.project_id = pr.id
       LEFT JOIN capture_points cp ON cp.zone_id = z.id AND cp.is_active = true
       LEFT JOIN photos p ON p.capture_point_id = cp.id
       LEFT JOIN snags s ON s.project_id = pr.id AND s.status = 'open'
       GROUP BY pr.id
       ORDER BY pr.created_at DESC`
    );

    client.release();

    res.status(200).json({ data: result.rows });
  } catch (err) {
    logger.error({ message: 'Dashboard projects error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch dashboard projects' });
  }
});

export default router;
