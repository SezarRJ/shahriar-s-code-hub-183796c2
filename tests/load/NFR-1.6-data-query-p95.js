import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
const API_BASE = __ENV.API_BASE || 'http://localhost:3001/api/v1';
const dashboardSummaryDuration = new Trend('dashboard_summary_duration', true);
const projectsDuration = new Trend('projects_duration', true);
const photosDuration = new Trend('photos_duration', true);
const capturePointsDuration = new Trend('capture_points_duration', true);
const reportsDuration = new Trend('reports_duration', true);
const snagsDuration = new Trend('snags_duration', true);
const notificationsDuration = new Trend('notifications_duration', true);
const errorRate = new Rate('query_errors');
export const options = {
  stages: [{ duration: '2m', target: 50 }, { duration: '3m', target: 100 }, { duration: '3m', target: 100 }, { duration: '2m', target: 0 }],
  thresholds: {
    'dashboard_summary_duration': ['p(95) < 500'], 'projects_duration': ['p(95) < 500'], 'photos_duration': ['p(95) < 500'], 'capture_points_duration': ['p(95) < 500'], 'reports_duration': ['p(95) < 500'], 'snags_duration': ['p(95) < 500'], 'notifications_duration': ['p(95) < 500'], 'http_req_duration': ['p(95) < 500'], 'query_errors': ['rate < 0.01'],
  },
};
function login(email, password) {
  const res = http.post(`${API_BASE}/auth/login`, JSON.stringify({ email, password }), { headers: { 'Content-Type': 'application/json' } });
  return res.status === 200 ? res.json('token') : null;
}
function makeRequest(method, path, token, metric) {
  const headers = { Authorization: `Bearer ${token}` };
  const start = Date.now();
  const res = method === 'GET' ? http.get(`${API_BASE}${path}`, { headers }) : http.get(`${API_BASE}${path}`, { headers });
  metric.add(Date.now() - start);
  errorRate.add(res.status !== 200 && res.status !== 204);
  return res;
}
export default function () {
  const token = login(__ENV.PM_EMAIL || 'pm@shahid.dev', __ENV.PM_PASSWORD || 'Password123!');
  if (!token) { sleep(1); return; }
  const summaryRes = makeRequest('GET', '/dashboard/summary', token, dashboardSummaryDuration);
  check(summaryRes, { 'dashboard summary is 200': (r) => r.status === 200, 'dashboard summary has data': (r) => r.status === 200 && r.json('data') !== null });
  sleep(2 + Math.random() * 3);
  const projectsRes = makeRequest('GET', '/projects?limit=20', token, projectsDuration);
  check(projectsRes, { 'projects list is 200': (r) => r.status === 200 });
  sleep(1 + Math.random() * 2);
  const projectId = summaryRes.json('data.active_projects') > 0 ? '00000000-0000-0000-0000-000000000001' : 'test-project';
  const capturePointsRes = makeRequest('GET', `/capture-points?project_id=${projectId}`, token, capturePointsDuration);
  check(capturePointsRes, { 'capture points list is 200': (r) => r.status === 200 });
  sleep(2 + Math.random() * 3);
  const photosRes = makeRequest('GET', `/photos?limit=20&offset=${Math.floor(Math.random() * 80)}`, token, photosDuration);
  check(photosRes, { 'photos list is 200': (r) => r.status === 200 });
  sleep(1 + Math.random() * 2);
  const reportsRes = makeRequest('GET', `/reports?project_id=${projectId}&limit=10`, token, reportsDuration);
  check(reportsRes, { 'reports list is 200': (r) => r.status === 200 });
  sleep(2 + Math.random() * 3);
  const snagsRes = makeRequest('GET', `/snags?project_id=${projectId}&status=open`, token, snagsDuration);
  check(snagsRes, { 'snags list is 200': (r) => r.status === 200 });
  sleep(1 + Math.random() * 2);
  const notificationsRes = makeRequest('GET', '/notifications?limit=50', token, notificationsDuration);
  check(notificationsRes, { 'notifications list is 200': (r) => r.status === 200 });
  sleep(3 + Math.random() * 5);
}
export function teardown() {
  console.log('NFR-1.6 Data Query P95 Test Complete');
}
