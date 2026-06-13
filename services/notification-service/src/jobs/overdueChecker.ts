import { Pool } from 'pg';
import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * SHAHID Overdue Capture Point Checker
 * Polls every 15 minutes for capture points that have exceeded their configured
 * capture frequency without a new photo. Sends push and email notifications to PMs.
 *
 * SRS: FR-5.3 — Trigger push notification when point > threshold days behind
 * SRS: FR-5.4 — Send in-app and email alert for critical delays (default 3 days)
 * AC-05 — Overdue capture point correctly triggers notification to PM
 */
export class OverdueChecker {
  private db: Pool;
  private notificationApiUrl: string;
  private timer: NodeJS.Timer | null = null;
  private checkIntervalMs: number = 15 * 60 * 1000; // 15 minutes

  constructor(db: Pool, notificationApiUrl: string = 'http://localhost:3003') {
    this.db = db;
    this.notificationApiUrl = notificationApiUrl;
  }

  start(): void {
    logger.info({ message: 'Overdue checker started', intervalMinutes: 15 });

    // Run immediately on start, then every 15 minutes
    this.runCheck();
    this.timer = setInterval(() => this.runCheck(), this.checkIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runCheck(): Promise<void> {
    try {
      logger.info({ message: 'Running overdue capture point check', timestamp: new Date().toISOString() });

      // Find all active capture points that are overdue
      const overdueResult = await this.db.query(`
        SELECT 
          cp.id as capture_point_id,
          cp.name as capture_point_name,
          cp.capture_frequency_hours,
          cp.zone_id,
          z.name as zone_name,
          z.project_id,
          p.name as project_name,
          p.tenant_id,
          p.alert_delay_threshold_days,
          p.alert_critical_delay_threshold_days,
          MAX(ph.captured_at) as last_capture_at,
          COUNT(ph.id) as total_photos
        FROM capture_points cp
        JOIN zones z ON z.id = cp.zone_id
        JOIN projects p ON p.id = z.project_id
        LEFT JOIN photos ph ON ph.capture_point_id = cp.id
        WHERE cp.is_active = true
          AND p.status = 'active'
        GROUP BY cp.id, cp.name, cp.capture_frequency_hours, cp.zone_id, 
                 z.name, z.project_id, p.name, p.tenant_id,
                 p.alert_delay_threshold_days, p.alert_critical_delay_threshold_days
        HAVING 
          MAX(ph.captured_at) IS NULL 
          OR (NOW() - MAX(ph.captured_at)) > (cp.capture_frequency_hours || ' hours')::interval
      `);

      const overduePoints = overdueResult.rows;
      logger.info({ message: 'Found overdue capture points', count: overduePoints.length });

      for (const point of overduePoints) {
        await this.processOverduePoint(point);
      }
    } catch (err) {
      logger.error({ message: 'Overdue check failed', error: (err as Error).message });
    }
  }

  private async processOverduePoint(point: any): Promise<void> {
    const lastCapture = point.last_capture_at ? new Date(point.last_capture_at) : null;
    const now = new Date();
    const hoursSince = lastCapture
      ? (now.getTime() - lastCapture.getTime()) / (1000 * 60 * 60)
      : Infinity;

    const daysBehind = Math.floor(hoursSince / 24);
    const delayThreshold = point.alert_delay_threshold_days || 1;
    const criticalThreshold = point.alert_critical_delay_threshold_days || 3;

    // Determine severity
    const isCritical = daysBehind >= criticalThreshold;
    const isOverdue = daysBehind >= delayThreshold;

    if (!isOverdue) return;

    // Find PMs and tenant admins for this project
    const usersResult = await this.db.query(`
      SELECT u.id, u.email, u.name, u.role
      FROM users u
      WHERE u.tenant_id = $1
        AND u.role IN ('project_manager', 'tenant_admin', 'super_admin')
        AND u.is_active = true
    `, [point.tenant_id]);

    const users = usersResult.rows;

    for (const user of users) {
      try {
        await this.sendNotification({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          type: isCritical ? 'critical_delay' : 'delay_alert',
          severity: isCritical ? 'critical' : 'warning',
          projectId: point.project_id,
          projectName: point.project_name,
          capturePointId: point.capture_point_id,
          capturePointName: point.capture_point_name,
          zoneName: point.zone_name,
          daysBehind,
          lastCaptureAt: point.last_capture_at,
          channels: isCritical ? ['push', 'email', 'in_app'] : ['push', 'in_app'],
        });
      } catch (err) {
        logger.error({
          message: 'Failed to send notification',
          userId: user.id,
          capturePointId: point.capture_point_id,
          error: (err as Error).message,
        });
      }
    }

    logger.info({
      message: 'Overdue point notifications sent',
      capturePointId: point.capture_point_id,
      capturePointName: point.capture_point_name,
      daysBehind,
      isCritical,
      recipients: users.length,
    });
  }

  private async sendNotification(payload: {
    userId: string;
    userEmail: string;
    userName: string;
    type: string;
    severity: string;
    projectId: string;
    projectName: string;
    capturePointId: string;
    capturePointName: string;
    zoneName: string;
    daysBehind: number;
    lastCaptureAt: string | null;
    channels: string[];
  }): Promise<void> {
    const title = payload.severity === 'critical'
      ? `⚠️ تأخير حرج: ${payload.capturePointName}`
      : `🔔 نقطة متأخرة: ${payload.capturePointName}`;

    const body = payload.severity === 'critical'
      ? `نقطة التقاط "${payload.capturePointName}" في مشروع "${payload.projectName}" متأخرة بـ ${payload.daysBehind} يوم. آخر صورة: ${payload.lastCaptureAt ? new Date(payload.lastCaptureAt).toLocaleDateString('ar-SA') : 'لم يتم التقاطها بعد'}.`
      : `نقطة التقاط "${payload.capturePointName}" متأخرة بـ ${payload.daysBehind} يوم. يرجى مراجعة التقدم.`;

    const htmlBody = `
      <div dir="rtl" style="font-family: Cairo, Arial, sans-serif; text-align: right;">
        <h2>${title}</h2>
        <p><strong>المشروع:</strong> ${payload.projectName}</p>
        <p><strong>المنطقة:</strong> ${payload.zoneName}</p>
        <p><strong>نقطة التقاط:</strong> ${payload.capturePointName}</p>
        <p><strong>الأيام المتأخرة:</strong> ${payload.daysBehind}</p>
        <p><strong>آخر صورة:</strong> ${payload.lastCaptureAt ? new Date(payload.lastCaptureAt).toLocaleDateString('ar-SA') : 'لم يتم التقاطها بعد'}</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          هذا الإشعار تم إنشاؤه تلقائياً من قبل منصة شاهد.<br>
          SRS v1.0 | Year 1 MVP
        </p>
      </div>
    `;

    await axios.post(`${this.notificationApiUrl}/send`, {
      user_id: payload.userId,
      type: payload.type,
      channels: payload.channels,
      payload: {
        title,
        body,
        html: htmlBody,
        severity: payload.severity,
        project_id: payload.projectId,
        capture_point_id: payload.capturePointId,
        days_behind: payload.daysBehind,
        last_capture_at: payload.lastCaptureAt,
        zone_name: payload.zoneName,
      },
    }, {
      timeout: 10000,
    });
  }
}
