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
import { generateWeeklyReport } from './generator/pdfGenerator';
import { WeeklyReportCron } from './jobs/weeklyReportCron';
import crypto from 'crypto';

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

// Start weekly report cron job (AC-04: auto-generate every Monday 08:00)
const reportCron = new WeeklyReportCron(pool, redis);
reportCron.start();
logger.info('Weekly report cron job started');

// Worker: process report queue
async function processReportQueue() {
  while (true) {
    try {
      const jobData = await redis.brpop('report:queue', 30);
      if (!jobData) continue;

      const job = JSON.parse(jobData[1]);
      logger.info({ message: 'Processing report job', jobId: job.jobId, projectId: job.project_id });

      // 1. Fetch project data
      const projectResult = await pool.query(
        'SELECT name, address FROM projects WHERE id = $1',
        [job.project_id]
      );
      const project = projectResult.rows[0];

      // 2. Fetch capture points and photos for the period
      const pointsResult = await pool.query(
        `SELECT cp.id, cp.name, z.name as zone, cp.expected_stage,
                COUNT(p.id) as photo_count, MAX(p.captured_at) as last_capture,
                cp.capture_frequency_hours
         FROM capture_points cp
         JOIN zones z ON z.id = cp.zone_id
         LEFT JOIN photos p ON p.capture_point_id = cp.id
           AND p.captured_at >= $2 AND p.captured_at < $3
         WHERE cp.is_active = true
         GROUP BY cp.id, cp.name, z.name, cp.expected_stage, cp.capture_frequency_hours
         ORDER BY cp.name`,
        [job.period_start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
         job.period_end || new Date().toISOString()]
      );

      const capturePoints = pointsResult.rows;
      const totalPoints = capturePoints.length;
      const pointsWithPhotos = capturePoints.filter((p: any) => p.photo_count > 0).length;
      const completionPercent = totalPoints > 0 ? Math.round((pointsWithPhotos / totalPoints) * 100) : 0;

      const now = new Date();
      const delayedPoints = capturePoints.map((p: any) => {
        const lastCapture = p.last_capture ? new Date(p.last_capture) : null;
        const hoursSince = lastCapture ? (now.getTime() - lastCapture.getTime()) / (1000 * 60 * 60) : Infinity;
        const isOverdue = hoursSince > p.capture_frequency_hours;
        const daysBehind = isOverdue ? Math.floor((hoursSince - p.capture_frequency_hours) / 24) : 0;
        return { ...p, is_overdue: isOverdue, days_behind: daysBehind };
      }).filter((p: any) => p.is_overdue);

      const avgPhotos = totalPoints > 0
        ? Math.round(capturePoints.reduce((sum: number, p: any) => sum + parseInt(p.photo_count), 0) / totalPoints)
        : 0;

      // 3. Generate report hash (integrity)
      const reportHash = crypto.randomBytes(16).toString('hex');

      // 4. Prepare report data for PDF
      const reportData = {
        project_id: job.project_id,
        project_name: project?.name || 'Unknown Project',
        project_address: project?.address || '—',
        period_start: job.period_start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period_end: job.period_end || new Date().toISOString().split('T')[0],
        generated_at: new Date().toISOString(),
        generated_by: job.triggered_by,
        total_capture_points: totalPoints,
        completion_percent: completionPercent,
        points_behind: delayedPoints.length,
        photos_per_point: avgPhotos,
        report_hash: reportHash,
        delayed_points: delayedPoints.map((p: any) => ({
          name: p.name,
          zone: p.zone,
          last_photo_date: p.last_capture ? new Date(p.last_capture).toLocaleDateString('ar-SA') : '—',
          days_behind: p.days_behind,
          status_class: p.days_behind > 3 ? 'status-critical' : 'status-delayed',
          status_label: p.days_behind > 3 ? 'تأخير حرج' : 'متأخر',
        })),
        capture_points: capturePoints.map((p: any) => ({
          name: p.name,
          zone: p.zone,
          expected_stage: p.expected_stage || '—',
          photo_count: p.photo_count,
          last_capture_date: p.last_capture ? new Date(p.last_capture).toLocaleDateString('ar-SA') : '—',
          status_class: p.photo_count > 0 ? 'status-on-time' : 'status-overdue',
          status_label: p.photo_count > 0 ? 'مكتمل' : 'معلّق',
        })),
        photos: [], // Can be populated with photo evidence if needed
      };

      // 5. Generate PDF
      const { fileUrl, fileSize } = await generateWeeklyReport(reportData);

      // 6. Insert report record into database
      await pool.query(
        `INSERT INTO reports (project_id, period_start, period_end, file_url, file_size_bytes, generated_by, triggered_by, report_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [job.project_id, reportData.period_start, reportData.period_end, fileUrl, fileSize, null, job.triggered_by, JSON.stringify(reportData)]
      );

      logger.info({ message: 'Report completed', jobId: job.jobId, fileUrl, fileSize });
    } catch (err) {
      logger.error({ message: 'Report worker error', error: (err as Error).message });
    }
  }
}

processReportQueue().catch(console.error);
