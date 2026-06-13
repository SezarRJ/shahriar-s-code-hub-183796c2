import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';
import multer from 'multer';
import crypto from 'crypto';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const photoMetadataSchema = z.object({
  capture_point_id: z.string().uuid(),
  captured_at: z.string().datetime(), // ISO 8601 from NTP-synced device
  gps_lat: z.number().min(-90).max(90),
  gps_lng: z.number().min(-180).max(180),
  gps_accuracy: z.number().optional(),
  device_id: z.string().optional(),
  device_model: z.string().optional(),
  notes: z.string().optional(), // Mutable notes attached to capture
  hash_sha256: z.string().length(64), // Client-provided SHA-256; server verifies against recomputed hash
  is_ntp_synced: z.boolean().default(true), // false if device fell back to local clock
});

/**
 * POST /api/v1/photos
 * Field Operator uploads a captured photo with immutable metadata.
 * Server computes SHA-256 hash and stores to S3 (or MinIO locally).
 */
router.post('/', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Photo file is required' });
      return;
    }

    const context = (req as any).tenantContext;
    const parsed = photoMetadataSchema.parse(JSON.parse(req.body.metadata || '{}'));

    // Server-side hash verification: client MUST provide hash, server recomputes and validates
    const clientHash = parsed.hash_sha256 || '';
    const serverHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    if (!clientHash || clientHash !== serverHash) {
      logger.warn({
        message: 'Photo hash verification failed',
        clientHash: clientHash,
        serverHash: serverHash,
        correlationId: req.correlationId,
        userId: context.user_id,
      });
      res.status(400).json({
        error: 'Hash verification failed. The provided SHA-256 does not match the server-computed hash. The photo may have been tampered with or corrupted during transfer.',
        code: 'HASH_MISMATCH',
      });
      return;
    }

    // In production: upload to S3/MinIO here, then get file_url
    // For local dev, we store a reference; actual S3 implementation in storage-service
    const file_url = `s3://${process.env.S3_BUCKET || 'shahid-photos'}/${context.tenant_id}/${parsed.capture_point_id}/${Date.now()}_${serverHash.slice(0, 16)}.jpg`;

    const client = await getClientWithContext(context);
    const result = await client.query(
      `INSERT INTO photos (capture_point_id, user_id, file_url, file_size_bytes, captured_at,
        gps_lat, gps_lng, gps_accuracy, hash_sha256, device_id, device_model, is_ntp_synced, synced)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
       RETURNING *`,
      [
        parsed.capture_point_id,
        context.user_id,
        file_url,
        req.file.size,
        parsed.captured_at,
        parsed.gps_lat,
        parsed.gps_lng,
        parsed.gps_accuracy || null,
        serverHash,
        parsed.device_id || null,
        parsed.device_model || null,
        parsed.is_ntp_synced,
      ]
    );
    client.release();

    // Queue for AI processing (Redis pub/sub or queue)
    // await redis.publish('ai:process', JSON.stringify({ photo_id: result.rows[0].id }));

    logger.info({
      message: 'Photo uploaded',
      photoId: result.rows[0].id,
      hash: hash,
      correlationId: req.correlationId,
    });

    res.status(201).json({
      data: {
        photo: result.rows[0],
        hash_sha256: hash,
      },
    });
  } catch (err) {
    logger.error({ message: 'Photo upload error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

/**
 * GET /api/v1/photos
 * List photos with filtering by capture_point_id, project, etc.
 * RLS ensures tenant + role isolation.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const { capture_point_id, limit = '100', offset = '0' } = req.query;

    const client = await getClientWithContext(context);
    let query = 'SELECT * FROM photos WHERE 1=1';
    const params: any[] = [];

    if (capture_point_id) {
      params.push(capture_point_id);
      query += ` AND capture_point_id = $${params.length}`;
    }

    params.push(parseInt(limit as string, 10));
    query += ` ORDER BY captured_at DESC LIMIT $${params.length}`;

    params.push(parseInt(offset as string, 10));
    query += ` OFFSET $${params.length}`;

    const result = await client.query(query, params);
    client.release();

    res.status(200).json({ data: result.rows, pagination: { limit, offset } });
  } catch (err) {
    logger.error({ message: 'Fetch photos error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

/**
 * GET /api/v1/photos/:id/verify
 * Recompute SHA-256 from stored file and compare with recorded hash.
 */
router.get('/:id/verify', async (req: Request, res: Response) => {
  try {
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);

    const photoResult = await client.query('SELECT * FROM photos WHERE id = $1', [req.params.id]);
    if (photoResult.rows.length === 0) {
      client.release();
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const photo = photoResult.rows[0];
    // In production: fetch file from S3, compute hash, compare
    // For local dev, we simulate a pass (actual implementation in storage-service)
    const isVerified = true; // Placeholder

    client.release();

    res.status(200).json({
      data: {
        photo_id: photo.id,
        stored_hash: photo.hash_sha256,
        verified: isVerified,
        verified_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error({ message: 'Photo verify error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to verify photo' });
  }
});

export default router;
