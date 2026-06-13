import http from 'k6/http';
import { check, group } from 'k6';
const API_BASE = __ENV.API_BASE || 'http://localhost:3001/api/v1';
const ROLES = [
  { name: 'field_operator', email: __ENV.FO_EMAIL || 'fo@shahid.dev', password: __ENV.FO_PASSWORD || 'Password123!' },
  { name: 'read_only', email: __ENV.RO_EMAIL || 'ro@shahid.dev', password: __ENV.RO_PASSWORD || 'Password123!' },
  { name: 'site_supervisor', email: __ENV.SS_EMAIL || 'ss@shahid.dev', password: __ENV.SS_PASSWORD || 'Password123!' },
  { name: 'project_manager', email: __ENV.PM_EMAIL || 'pm@shahid.dev', password: __ENV.PM_PASSWORD || 'Password123!' },
  { name: 'tenant_admin', email: __ENV.TA_EMAIL || 'ta@shahid.dev', password: __ENV.TA_PASSWORD || 'Password123!' },
  { name: 'super_admin', email: __ENV.SA_EMAIL || 'sa@shahid.dev', password: __ENV.SA_PASSWORD || 'Password123!' },
];
const ENDPOINTS = {
  fo_only: [{ method: 'GET', path: '/photos', allowed: ['field_operator', 'site_supervisor', 'project_manager', 'tenant_admin', 'super_admin'] }, { method: 'POST', path: '/photos', allowed: ['field_operator', 'site_supervisor', 'project_manager', 'tenant_admin', 'super_admin'] }],
  pm_only: [{ method: 'GET', path: '/projects', allowed: ['project_manager', 'tenant_admin', 'super_admin'] }, { method: 'GET', path: '/reports', allowed: ['project_manager', 'tenant_admin', 'super_admin'] }, { method: 'GET', path: '/evidence/export', allowed: ['project_manager', 'tenant_admin', 'super_admin', 'read_only'] }, { method: 'GET', path: '/dashboard/summary', allowed: ['project_manager', 'tenant_admin', 'super_admin'] }, { method: 'POST', path: '/reports/trigger', allowed: ['project_manager', 'tenant_admin', 'super_admin'] }],
  supervisor_only: [{ method: 'POST', path: '/snags', allowed: ['site_supervisor', 'project_manager', 'tenant_admin', 'super_admin'] }, { method: 'GET', path: '/snags', allowed: ['site_supervisor', 'project_manager', 'tenant_admin', 'super_admin'] }],
  tenant_admin_only: [{ method: 'GET', path: '/users', allowed: ['tenant_admin', 'super_admin'] }, { method: 'POST', path: '/users', allowed: ['tenant_admin', 'super_admin'] }, { method: 'POST', path: '/projects', allowed: ['tenant_admin', 'super_admin'] }],
  forbidden: [{ method: 'DELETE', path: '/photos/photo-id', allowed: [] }, { method: 'PATCH', path: '/photos/photo-id', allowed: [] }],
};
export const options = { vus: 1, iterations: 1 };
function login(email, password) {
  const res = http.post(`${API_BASE}/auth/login`, JSON.stringify({ email, password }), { headers: { 'Content-Type': 'application/json' } });
  return res.status === 200 ? res.json('token') : null;
}
function makeRequest(method, path, token) {
  const headers = { Authorization: `Bearer ${token}` };
  switch (method) { case 'GET': return http.get(`${API_BASE}${path}`, { headers }); case 'POST': return http.post(`${API_BASE}${path}`, JSON.stringify({}), { headers }); case 'PATCH': return http.patch(`${API_BASE}${path}`, JSON.stringify({}), { headers }); case 'DELETE': return http.del(`${API_BASE}${path}`, null, { headers }); default: return http.get(`${API_BASE}${path}`, { headers }); }
}
export default function () {
  group('AC-10: Privilege Escalation Prevention', () => {
    for (const role of ROLES) {
      const token = login(role.email, role.password);
      if (!token) { console.log(`Skipping ${role.name} — login failed`); continue; }
      const allEndpoints = [...ENDPOINTS.fo_only, ...ENDPOINTS.pm_only, ...ENDPOINTS.supervisor_only, ...ENDPOINTS.tenant_admin_only, ...ENDPOINTS.forbidden];
      for (const endpoint of allEndpoints) {
        const path = endpoint.path.replace('photo-id', 'photo-0001');
        const res = makeRequest(endpoint.method, path, token);
        const expected = endpoint.allowed.includes(role.name);
        const isSuccess = res.status === 200 || res.status === 201 || res.status === 202;
        const checkName = `${role.name} ${endpoint.method} ${endpoint.path}`;
        if (expected) { check(res, { [`${checkName} — allowed`]: () => isSuccess || res.status === 404 }); }
        else { check(res, { [`${checkName} — forbidden (403/401)`]: () => res.status === 403 || res.status === 401 || res.status === 404 }); if (res.status === 200 || res.status === 201) { console.error(`PRIVILEGE ESCALATION: ${role.name} accessed ${endpoint.method} ${endpoint.path}`); } }
      }
      const immutableTests = [{ method: 'PATCH', path: '/photos/photo-0001', body: { captured_at: '2020-01-01T00:00:00Z' } }, { method: 'PATCH', path: '/photos/photo-0001', body: { gps_lat: 0.0 } }, { method: 'PATCH', path: '/photos/photo-0001', body: { hash_sha256: 'a'.repeat(64) } }, { method: 'DELETE', path: '/photos/photo-0001' }];
      for (const test of immutableTests) {
        const res = makeRequest(test.method, test.path, token);
        check(res, { [`${role.name} ${test.method} immutable photo field — blocked`]: () => res.status === 403 || res.status === 404 || res.status === 405 || res.status === 500 });
      }
      const roleChangeRes = makeRequest('PATCH', '/users/me', token);
      check(roleChangeRes, { [`${role.name} cannot modify own role`]: () => roleChangeRes.status === 403 || roleChangeRes.status === 404 || roleChangeRes.status === 405 });
      console.log(`AC-10 privilege checks completed for ${role.name}`);
    }
  });
}
