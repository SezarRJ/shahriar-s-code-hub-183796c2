import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getClientWithContext } from '../utils/db';
import { logger } from '../utils/logger';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

/**
 * POST /api/v1/capture-points/bulk-import
 * Bulk import capture points from CSV file.
 * SRS AC-03: Minimum 50 points, CSV template provided.
 *
 * CSV columns: zone_id, name, description, expected_stage, capture_frequency_hours, gps_lat, gps_lng
 */
const csvPointSchema = z.object({
  zone_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  expected_stage: z.string().optional(),
  capture_frequency_hours: z.string().optional().default('24'),
  gps_lat: z.string().optional(),
  gps_lng: z.string().optional(),
});

router.post('/bulk-import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'CSV file is required', code: 'MISSING_FILE' });
      return;
    }

    if (!req.file.originalname.toLowerCase().endsWith('.csv') &&
        req.file.mimetype !== 'text/csv') {
      res.status(400).json({ error: 'File must be a CSV', code: 'INVALID_FILE_TYPE' });
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.trim().split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      res.status(400).json({ error: 'CSV is empty or missing data rows', code: 'EMPTY_CSV' });
      return;
    }

    // Parse header
    const header = lines[0].toLowerCase().trim().split(',').map(h => h.trim());
    const requiredCols = ['zone_id', 'name'];
    for (const col of requiredCols) {
      if (!header.includes(col)) {
        res.status(400).json({
          error: `CSV header missing required column: ${col}`,
          code: 'INVALID_HEADER',
          required: requiredCols,
          found: header,
        });
        return;
      }
    }

    const colIndex = (col: string) => header.indexOf(col);

    // Parse data rows
    const points: z.infer<typeof csvPointSchema>[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const rowData: Record<string, string> = {};

      for (const col of header) {
        const idx = colIndex(col);
        rowData[col] = idx >= 0 && idx < cols.length ? cols[idx] : '';
      }

      try {
        const parsed = csvPointSchema.parse(rowData);
        points.push(parsed);
      } catch (e: any) {
        errors.push({ row: i + 1, message: e.errors?.[0]?.message || 'Validation failed' });
      }
    }

    // SRS AC-03: Minimum 50 points
    if (points.length < 50) {
      res.status(400).json({
        error: `CSV must contain at least 50 valid capture points. Found: ${points.length}`,
        code: 'INSUFFICIENT_POINTS',
        minimum: 50,
        valid: points.length,
        total_rows: lines.length - 1,
        validation_errors: errors.slice(0, 20), // Show first 20 errors
      });
      return;
    }

    // Insert all valid points in a transaction
    const context = (req as any).tenantContext;
    const client = await getClientWithContext(context);

    await client.query('BEGIN');

    const inserted = [];
    const insertErrors = [];

    for (const point of points) {
      try {
        const result = await client.query(
          `INSERT INTO capture_points (zone_id, name, description, expected_stage, capture_frequency_hours, gps_lat, gps_lng)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            point.zone_id,
            point.name,
            point.description || null,
            point.expected_stage || null,
            parseInt(point.capture_frequency_hours, 10),
            point.gps_lat ? parseFloat(point.gps_lat) : null,
            point.gps_lng ? parseFloat(point.gps_lng) : null,
          ]
        );
        inserted.push(result.rows[0]);
      } catch (e: any) {
        insertErrors.push({ name: point.name, error: e.message });
      }
    }

    await client.query('COMMIT');
    client.release();

    logger.info({
      message: 'Bulk import complete',
      totalRows: points.length + errors.length,
      valid: points.length,
      inserted: inserted.length,
      failed: insertErrors.length + errors.length,
      userId: context.user_id,
      correlationId: req.correlationId,
    });

    res.status(201).json({
      data: {
        inserted: inserted.length,
        failed: insertErrors.length + errors.length,
        total: points.length + errors.length,
        points: inserted,
        errors: [...errors, ...insertErrors.map(e => ({ row: e.name, message: e.error }))].slice(0, 50),
      },
    });
  } catch (err) {
    logger.error({ message: 'Bulk import error', error: (err as Error).message, correlationId: req.correlationId });
    res.status(500).json({ error: 'Failed to import capture points' });
  }
});

export default router;
