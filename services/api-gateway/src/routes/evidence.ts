import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

const evidenceQuerySchema = z.object({
  photo_id: z.string().uuid(),
});

/**
 * GET /api/v1/evidence/export
 * Export an evidence package for a photo including:
 * - photo metadata
 * - capture point info
 * - GPS, timestamp, SHA-256 hash
 * Returns structured data; PDF generation in report-service.
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const parsed = evidenceQuerySchema.parse(req.query);

    const client = await getClientWithContext(context);

    const photoResult = await client.query(
      `SELECT p.*, cp.name as capture_point_name, cp.description as capture_point_description,
              z.name as zone_name, pr.name as project_name, pr.address as project_address,
              u.name as captured_by_name
       FROM photos p
       JOIN capture_points cp ON cp.id = p.capture_point_id
       JOIN zones z ON z.id = cp.zone_id
       JOIN projects pr ON pr.id = z.project_id
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [parsed.photo_id]
    );

    if (photoResult.rows.length === 0) {
      client.release();
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const photo = photoResult.rows[0];

    // Fetch history of same capture point
    const historyResult = await client.query(
      `SELECT id, captured_at, hash_sha256, file_url
       FROM photos
       WHERE capture_point_id = $1 AND id != $2
       ORDER BY captured_at DESC
       LIMIT 10`,
      [photo.capture_point_id, photo.id]
    );

    client.release();

    const evidencePackage = {
      photo_id: photo.id,
      project: {
        name: photo.project_name,
        address: photo.project_address,
      },
      capture_point: {
        name: photo.capture_point_name,
        description: photo.capture_point_description,
        zone: photo.zone_name,
      },
      capture: {
        captured_by: photo.captured_by_name,
        captured_at: photo.captured_at,
        gps: {
          latitude: photo.gps_lat,
          longitude: photo.gps_lng,
          accuracy: photo.gps_accuracy,
        },
        device_id: photo.device_id,
        device_model: photo.device_model,
      },
      integrity: {
        hash_sha256: photo.hash_sha256,
        file_url: photo.file_url,
        file_size_bytes: photo.file_size_bytes,
      },
      history: historyResult.rows,
      generated_at: new Date().toISOString(),
    };

    logger.info({
      message: 'Evidence package exported',
      photoId: photo.id,
      correlationId: req.correlationId,
    });

    res.status(200).json({ data: evidencePackage });
  } catch (err) {
    logger.error({ message: 'Evidence export error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to export evidence' });
  }
});

export default router;
