/**
 * SHAHID Service Health Check — Smoke Test
 * Validates all core services are responsive before running heavy load tests.
 *
 * Usage: k6 run --vus 1 --iterations 1 health-check.js
 */

import http from 'k6/http';
import { check, group } from 'k6';

const SERVICES = {
  'api-gateway': __ENV.API_GATEWAY_URL || 'http://localhost:3001',
  'ai-service': __ENV.AI_SERVICE_URL || 'http://localhost:5001',
  'report-service': __ENV.REPORT_SERVICE_URL || 'http://localhost:3002',
  'notification-service': __ENV.NOTIFICATION_SERVICE_URL || 'http://localhost:3003',
  'storage-service': __ENV.STORAGE_SERVICE_URL || 'http://localhost:3004',
};

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  group('Service Health Checks', () => {
    for (const [name, url] of Object.entries(SERVICES)) {
      const res = http.get(`${url}/health`);
      check(res, {
        [`${name} is healthy`]: (r) => r.status === 200 && r.json('status') === 'ok',
      });
    }
  });
}
