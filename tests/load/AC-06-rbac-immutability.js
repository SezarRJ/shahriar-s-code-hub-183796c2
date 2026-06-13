/**
 * SHAHID Load Test — AC-06
 * Requirement: No user role (including Super Admin) can edit, overwrite, or delete
 * the captured_at, GPS coordinates, or SHA-256 hash fields of any photo record.
 *
 * This test attempts mutation via the API for every defined role.
 * All attempts must return 403 Forbidden or 400/500 with immutable constraint.
 *
 * Usage: k6 run --vus 1 --iterations 1 AC-06-rbac-immutability.js
 */

import http from 'k6/http';
import { check, group } from 'k6';

const API_BASE = __ENV.API_BASE || 'http://localhost:3001/api/v1';

const ROLES = [
  { name: 'super_admin', email: __ENV.SA_EMAIL || 'sa@test.com', password: __ENV.SA_PASSWORD || 'Password123!' },
  { name: 'tenant_admin', email: __ENV.TA_EMAIL || 'ta@test.com', password: __ENV.TA_PASSWORD || 'Password123!' },
  { name: 'project_manager', email: __ENV.PM_EMAIL || 'pm@test.com', password: __ENV.PM_PASSWORD || 'Password123!' },
  { name: 'site_supervisor', email: __ENV.SS_EMAIL || 'ss@test.com', password: __ENV.SS_PASSWORD || 'Password123!' },
  { name: 'field_operator', email: __ENV.FO_EMAIL || 'fo@test.com', password: __ENV.FO_PASSWORD || 'Password123!' },
  { name: 'read_only', email: __ENV.RO_EMAIL || 'ro@test.com', password: __ENV.RO_PASSWORD || 'Password123!' },
];

export const options = {
  vus: 1,
  iterations: 1,
};

function login(email, password) {
  const res = http.post(`${API_BASE}/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status !== 200) {
    console.warn(`Login failed for ${email}: ${res.status}`);
    return null;
  }
  return res.json('token');
}

export default function () {
  group('AC-06: RBAC Immutability Enforcement', () => {
    for (const role of ROLES) {
      const token = login(role.email, role.password);
      if (!token) continue;

      // Attempt 1: GET a photo (should succeed)
      const photosRes = http.get(`${API_BASE}/photos?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let photoId = null;
      if (photosRes.status === 200 && photosRes.json('data') && photosRes.json('data').length > 0) {
        photoId = photosRes.json('data')[0].id;
      }

      if (!photoId) {
        console.log(`No photos found for ${role.name}, skipping mutation attempt.`);
        continue;
      }

      // Attempt 2: PATCH captured_at (must fail)
      const patchTimeRes = http.patch(
        `${API_BASE}/photos/${photoId}`,
        JSON.stringify({ captured_at: '2020-01-01T00:00:00Z' }),
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      check(patchTimeRes, {
        [`${role.name} cannot modify captured_at`]: (r) => r.status === 403 || r.status === 400 || r.status === 500 || r.status === 404,
      });

      // Attempt 3: PATCH gps_lat (must fail)
      const patchGpsRes = http.patch(
        `${API_BASE}/photos/${photoId}`,
        JSON.stringify({ gps_lat: 0.0 }),
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      check(patchGpsRes, {
        [`${role.name} cannot modify gps_lat`]: (r) => r.status === 403 || r.status === 400 || r.status === 500 || r.status === 404,
      });

      // Attempt 4: PATCH hash_sha256 (must fail)
      const patchHashRes = http.patch(
        `${API_BASE}/photos/${photoId}`,
        JSON.stringify({ hash_sha256: 'a'.repeat(64) }),
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      check(patchHashRes, {
        [`${role.name} cannot modify hash_sha256`]: (r) => r.status === 403 || r.status === 400 || r.status === 500 || r.status === 404,
      });

      // Attempt 5: DELETE photo (must fail)
      const deleteRes = http.del(`${API_BASE}/photos/${photoId}`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });

      check(deleteRes, {
        [`${role.name} cannot delete photo`]: (r) => r.status === 403 || r.status === 400 || r.status === 500 || r.status === 404,
      });

      console.log(`AC-06 check complete for role: ${role.name}`);
    }
  });
}
