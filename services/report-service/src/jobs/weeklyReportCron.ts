import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

/**
 * SHAHID Weekly Report Cron Job
 * Triggers report generation every Monday at 08:00 local time for each project.
 *
 * SRS: FR-4.1 — Auto-generate weekly progress report every Monday at 08:00
 * AC-04 — System automatically generates weekly PDF without manual intervention
 */
export class WeeklyReportCron {
  private db: Pool;
  private redis: Redis;
  private timer: NodeJS.Timer | null = null;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  start(): void {
    // Calculate time until next Monday 08:00
    const nextRun = this.getNextMonday0800();
    const delay = nextRun.getTime() - Date.now();

    logger.info({
      message: 'Weekly report cron scheduled',
      nextRun: nextRun.toISOString(),
      delayMs: delay,
    });

    // Schedule first run
    setTimeout(() => {
      this.runJob();
      // Then schedule every 7 days
      this.timer = setInterval(() => this.runJob(), 7 * 24 * 60 * 60 * 1000);
    }, delay);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private getNextMonday0800(): Date {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
    const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;

    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(8, 0, 0, 0);
    nextMonday.setMinutes(0);
    nextMonday.setSeconds(0);
    nextMonday.setMilliseconds(0);

    // If it's Monday but already past 08:00, schedule for next Monday
    if (day === 1 && now.getHours() >= 8) {
      nextMonday.setDate(nextMonday.getDate() + 7);
    }

    return nextMonday;
  }

  async runJob(): Promise<void> {
    try {
      logger.info({ message: 'Weekly report cron job started', timestamp: new Date().toISOString() });

      // Get all active projects with their configured timezone
      const projectsResult = await this.db.query(
        `SELECT id, report_language, capture_frequency_hours
         FROM projects
         WHERE status = 'active'`
      );

      const projects = projectsResult.rows;
      logger.info({ message: 'Found active projects for weekly reports', count: projects.length });

      for (const project of projects) {
        // Calculate reporting period: previous Monday 08:00 to current Monday 08:00
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
        const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const periodEnd = new Date(now);
        periodEnd.setHours(8, 0, 0, 0);
        periodEnd.setMinutes(0);
        periodEnd.setSeconds(0);
        periodEnd.setMilliseconds(0);

        const periodStart = new Date(periodEnd);
        periodStart.setDate(periodEnd.getDate() - 7);

        const jobId = `report:${project.id}:${Date.now()}`;
        const jobData = {
          jobId,
          project_id: project.id,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          triggered_by: 'auto',
          queued_at: new Date().toISOString(),
        };

        await this.redis.lpush('report:queue', JSON.stringify(jobData));
        logger.info({
          message: 'Weekly report queued',
          jobId,
          projectId: project.id,
          periodStart: jobData.period_start,
          periodEnd: jobData.period_end,
        });
      }

      logger.info({
        message: 'Weekly report cron job completed',
        projectsQueued: projects.length,
      });
    } catch (err) {
      logger.error({ message: 'Weekly report cron job failed', error: (err as Error).message });
    }
  }

  /**
   * Trigger manual report generation for a specific project.
   */
  async triggerManual(projectId: string, triggeredBy: string): Promise<string> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setHours(8, 0, 0, 0);
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodEnd.getDate() - 7);

    const jobId = `report:${projectId}:${Date.now()}:manual`;
    const jobData = {
      jobId,
      project_id: projectId,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      triggered_by: triggeredBy,
      queued_at: new Date().toISOString(),
    };

    await this.redis.lpush('report:queue', JSON.stringify(jobData));
    return jobId;
  }
}
