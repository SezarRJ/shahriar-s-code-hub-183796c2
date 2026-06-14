import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const services = [
    { name: 'storage-service', url: `${process.env.STORAGE_SERVICE_URL || 'http://localhost:3004'}/health` },
    { name: 'ai-service', url: `${process.env.AI_SERVICE_URL || 'http://localhost:5001'}/health` },
    { name: 'notification-service', url: `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003'}/health` },
    { name: 'report-service', url: `${process.env.REPORT_SERVICE_URL || 'http://localhost:3002'}/health` },
  ];

  const checks = await Promise.all(services.map(async (s) => {
    try {
      const start = Date.now();
      const resp = await axios.get(s.url, { timeout: 2000 });
      return { service: s.name, status: 'healthy', latency: `${Date.now() - start}ms`, details: resp.data };
    } catch (e: any) {
      return { service: s.name, status: 'unhealthy', error: e.message };
    }
  }));

  const overallStatus = checks.every(c => c.status === 'healthy') ? 'healthy' : 'degraded';
  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: checks
  });
});

export default router;
