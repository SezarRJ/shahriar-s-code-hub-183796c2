/**
 * SHAHID Report Service
 * Generates weekly PDF reports and handles schedule comparison logic.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'report-service' });
});

/**
 * POST /generate
 * Queues report generation for a project.
 */
app.post('/generate', async (req, res) => {
  try {
    const { project_id, period_start, period_end, triggered_by = 'manual' } = req.body;

    if (!project_id) {
      res.status(400).json({ error: 'project_id is required' });
      return;
    }

    const jobId = `report:${project_id}:${Date.now()}`;
    await redis.lpush('report:queue', JSON.stringify({
      jobId,
      project_id,
      period_start,
      period_end,
      triggered_by,
      queued_at: new Date().toISOString(),
    }));

    logger.info({ message: 'Report queued', jobId, project_id, triggered_by });

    res.status(202).json({ jobId, status: 'queued' });
  } catch (err) {
    logger.error({ message: 'Queue report error', error: (err as Error).message });
    res.status(500).json({ error: 'Failed to queue report' });
  }
});

/**
 * GET /schedule-status/:project_id
 * Returns capture point schedule comparison data.
 */
app.get('/schedule-status/:project_id', async (req, res) => {
  try {
    const { project_id } = req.params;

    const result = await pool.query(
      `SELECT cp.id, cp.name, cp.expected_stage, cp.capture_frequency_hours,
              MAX(p.captured_at) as last_captured_at,
              COUNT(p.id) as photo_count
       FROM capture_points cp
       LEFT JOIN photos p ON p.capture_point_id = cp.id
       WHERE cp.zone_id IN (
         SELECT z.id FROM zones z WHERE z.project_id = $1
       )
       AND cp.is_active = true
       GROUP BY cp.id, cp.name, cp.expected_stage, cp.capture_frequency_hours
       ORDER BY cp.name`,
      [project_id]
    );

    const now = new Date();
    const statusData = result.rows.map((row: any) => {
      const lastCapture = row.last_captured_at ? new Date(row.last_captured_at) : null;
      const hoursSince = lastCapture
        ? (now.getTime() - lastCapture.getTime()) / (1000 * 60 * 60)
        : Infinity;
      const isOverdue = hoursSince > row.capture_frequency_hours;
      const daysBehind = isOverdue ? Math.floor((hoursSince - row.capture_frequency_hours) / 24) : 0;

      return {
        ...row,
        hours_since_last_capture: hoursSince === Infinity ? null : Math.round(hoursSince),
        is_overdue: isOverdue,
        days_behind: daysBehind,
      };
    });

    res.status(200).json({ data: statusData });
  } catch (err) {
    logger.error({ message: 'Schedule status error', error: (err as Error).message });
    res.status(500).json({ error: 'Failed to get schedule status' });
  }
});

app.listen(PORT, () => {
  logger.info(`Report Service running on port ${PORT}`);
});

// Worker: process report queue
async function processReportQueue() {
  while (true) {
    try {
      const jobData = await redis.brpop('report:queue', 30);
      if (!jobData) continue;

      const job = JSON.parse(jobData[1]);
      logger.info({ message: 'Processing report job', jobId: job.jobId });

      // In production: generate PDF via Puppeteer + HTML template, upload to S3
      // Then insert into reports table
      // For now, log and mark complete

      logger.info({ message: 'Report completed', jobId: job.jobId });
    } catch (err) {
      logger.error({ message: 'Report worker error', error: (err as Error).message });
    }
  }
}

processReportQueue().catch(console.error);
