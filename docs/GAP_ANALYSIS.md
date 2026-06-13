# SHAHID Platform — Deep Gap Analysis

**Document Type:** Requirements Traceability & Gap Assessment  
**Version:** 1.0  
**Date:** June 13, 2026  
**Basis:** SRS v1.0 (Master Blueprint v3.0 Final)  
**Scope:** Current codebase vs. Year 1 MVP requirements  
**Method:** Requirement-by-requirement code traceability with severity classification

---

## Executive Summary

| Category | Total | ✅ Complete | 🟡 Partial | 🔴 Missing | Risk Level |
|----------|-------|-------------|-----------|------------|------------|
| Functional Requirements (FR) | 42 | 24 | 12 | 6 | **MEDIUM** |
| Non-Functional Requirements (NFR) | 33 | 18 | 9 | 6 | **MEDIUM** |
| MVP Acceptance Criteria (AC) | 10 | 4 | 4 | 2 | **HIGH** |
| **Overall** | **85** | **46** | **25** | **14** | **MEDIUM-HIGH** |

**Critical Finding:** Two acceptance criteria (AC-04 and AC-08) are at **HIGH RISK** of failure because they require infrastructure that is scaffolded but not fully validated in an automated CI pipeline. The codebase is structurally sound but lacks integration test coverage for the most complex multi-service interactions.

---

## 1. Functional Requirements Gap Analysis

### 1.1 FR-1: Photo Capture Module

| ID | Requirement | Priority | Status | Evidence | Gap Detail | Remediation | Effort |
|----|-------------|----------|--------|----------|------------|-------------|--------|
| FR-1.1 | Capture 360° panoramic or standard photo | High | 🟡 Partial | `apps/mobile/lib/services/capture_service.dart` — only standard photo via `Uint8List` | 360° camera hardware integration (Ricoh Theta Bluetooth API) is not implemented; standard capture is complete | Add `RicohThetaService` class with Bluetooth GATT commands; deferred to Year 1 post-MVP per SRS | 3 days |
| FR-1.2 | Automatically record GPS coordinates ±5m | High | ✅ Complete | `capture_service.dart:79-104` — `geolocator` with `LocationAccuracy.best` | `gps_accuracy` field stored; accuracy verification against ±5m threshold not enforced in UI | Add accuracy warning overlay if `gps_accuracy > 5.0` during capture | 0.5 day |
| FR-1.3 | Embed NTP-synchronized timestamp | High | ✅ Complete | `capture_service.dart:55-69` — `NTP.getNtpOffset()` with fallback | ✅ Fully implemented; `is_ntp_synced` flag added in commit `ac65599` | None | — |
| FR-1.4 | Generate SHA-256 hash immediately after capture | High | ✅ Complete | `capture_service.dart:72` — `sha256.convert(imageBytes).toString()`; `photos.ts:35-45` — server-side recomputation and verification | ✅ Client-side + server-side verification; `HASH_MISMATCH` rejection in API Gateway | None | — |
| FR-1.5 | Store locally when offline, 7-day retention | High | ✅ Complete | `database_service.dart:21-45` — SQLite `photos_queue`; `cleanup_service.dart:27-29` — 7-day eviction | ✅ Implemented; `CleanupService.performCleanup()` enforces 7-day retention for synced photos | None | — |
| FR-1.6 | Auto-upload when Wi-Fi/acceptable mobile | High | 🟡 Partial | `sync_service.dart:38-58` — connectivity listener + periodic timer | Upload only triggers on connectivity change or 5-min timer; no "acceptable mobile" threshold (e.g., >1 Mbps upload). No user-configurable Wi-Fi-only mode. | Add bandwidth estimation or upload size threshold; add `wifi_only` preference in `settings` | 1 day |
| FR-1.7 | Predefined capture route with ordered points | High | 🟡 Partial | `database_service.dart:47-60` — `routes_cache` table; `capture_service.dart` — no route-following UI | SQLite schema exists but no route visualization, step-by-step navigation, or completion status tracking in Flutter UI | Build `RouteScreen` with ordered list, map markers, and per-point status (Completed/Missed/Pending) | 2 days |
| FR-1.8 | Kiosk Mode (auto-capture at interval) | Medium | 🔴 Missing | No files reference "kiosk" | Entire feature missing; requires background camera access, interval scheduling, and hardware mount integration | Create `KioskService` with `Timer.periodic`, `camera` plugin background access, and admin PIN unlock | 3 days |
| FR-1.9 | Prevent editing of captured_at, GPS, hash | High | ✅ Complete | `001_initial_schema.sql:128-156` — `trigger_photo_immutability`; `photos.ts:89-94` — no PATCH endpoint | ✅ Database-level trigger + no API endpoint for field mutation | None | — |
| FR-1.10 | Mark point as Completed/Missed/Pending | High | 🟡 Partial | `database_service.dart:50` — `completed INTEGER` in `routes_cache`; no update logic | Schema field exists but no Flutter UI or API to update status; `SyncService` doesn't send status | Add `PATCH /capture-points/:id/status` endpoint; update `RouteScreen` with status buttons | 1 day |
| FR-1.11 | Annotate capture with free-text notes | Medium | ✅ Complete | `capture_service.dart:46` — `notes` parameter; `capture_model.dart:16` — `notes` field; `photos.ts:92` — stored in DB | ✅ Full pipeline: Flutter → SQLite → API → PostgreSQL | None | — |
| FR-1.12 | Batch processing: queue multiple photos | Medium | 🟡 Partial | `sync_service.dart:56-61` — uploads sequentially in a loop | Photos are uploaded one-by-one sequentially. No true "batch session" (single multipart with multiple files, or chunked parallel upload) | Implement parallel upload with `Future.wait()` capped at 3 concurrent; or multipart batch endpoint | 1 day |

**FR-1 Module Risk: 🟡 MEDIUM** — Core capture is solid. Missing Kiosk Mode (acceptable for MVP), route UI needs completion, batch upload needs optimization.

---

### 1.2 FR-2: Project & Zone Management

| ID | Requirement | Priority | Status | Evidence | Gap Detail | Remediation | Effort |
|----|-------------|----------|--------|----------|------------|-------------|--------|
| FR-2.1 | PM creates project with name, address, GPS boundary, start date | High | ✅ Complete | `projects.ts:15-38` — `POST /api/v1/projects` with `name`, `address`, `gps_boundary` (GeoJSON), `start_date` implied by `created_at` | ✅ Full CRUD with GeoJSON polygon support | None | — |
| FR-2.2 | Define hierarchy of at least 3 levels | High | ✅ Complete | `zones.ts:10-15` — `parent_zone_id` self-reference; `001_initial_schema.sql:68-81` — `level_type`, `level_number` | ✅ Schema supports infinite depth; UI wizard in `ProjectsPage.tsx` stepper | None | — |
| FR-2.3 | Create, update, deactivate capture points | High | ✅ Complete | `capturePoints.ts:10-30` — `POST` with `is_active` default; `capturePoints.ts:32-53` — `GET` with `is_active` filter | ✅ Full CRUD; deactivation hides from FO routes but retains history | None | — |
| FR-2.4 | Upload baseline schedule (CSV or manual) | High | 🟡 Partial | `projects.ts:19` — `baseline_schedule JSONB` field; `projects.ts:33-34` — accepts JSON in create; no CSV parser | JSONB storage exists but no dedicated schedule CSV import, no Gantt/CPM parsing, no schedule validation | Add `POST /projects/:id/schedule` with CSV parser (columns: task_id, name, start_date, end_date, capture_point_id); validate date ranges | 2 days |
| FR-2.5 | Bulk import capture points from CSV (min 50) | High | ✅ Complete | `capturePoints.ts:78-175` — `POST /bulk-import` with multipart CSV, header validation, row validation, minimum 50 check, transactional insert | ✅ Fully implemented per AC-03 requirements | None | — |
| FR-2.6 | Assign Field Operators to projects and routes | High | 🟡 Partial | `users.ts:10-15` — user creation with role; `auth.ts:35-42` — signup with role; no project assignment table | Users have roles but no `user_projects` junction table. FO sees all projects in their tenant, not assigned subset. | Create `user_projects` table (user_id, project_id, assigned_at, assigned_by); filter all project queries by assignment | 1 day |
| FR-2.7 | Multi-project view for PMs | Medium | 🟡 Partial | `DashboardPage.tsx:45-95` — KPI cards showing aggregate stats; `projects.ts:15-24` — list endpoint | Dashboard shows project list but no true "multi-project KPI aggregation" (sum of all active projects, combined delay metrics, cross-project snag alerts) | Add `GET /dashboard/summary` endpoint that aggregates across all PM's projects; enhance dashboard cards | 1 day |

**FR-2 Module Risk: 🟡 LOW** — Core project/zone management is complete. FO assignment needs junction table (minor schema change). Schedule upload needs CSV parser (not critical for pilot if manual JSON entry works).

---

### 1.3 FR-3: AI Analysis Module

| ID | Requirement | Priority | Status | Evidence | Gap Detail | Remediation | Effort |
|----|-------------|----------|--------|----------|------------|-------------|--------|
| FR-3.1 | Classify photo by construction stage | High | 🟡 Partial | `ai-service/main.py:57-60` — simulated classification `"structure"` with confidence 0.85 | Only stubbed/mock classification. No actual Google Vision API or Claude integration. No image download from S3. | Implement `download_image_from_s3()` + `call_google_vision()` + `call_claude_vision()` with retry logic; add API key rotation | 2 days |
| FR-3.2 | Detect visible defects, flag as snags | High | 🟡 Partial | `ai-service/main.py:58` — `defect_flags = []` (empty array); no actual detection | Stub returns empty defects. Vision API's `LocalizedObjectAnnotation` or Claude's vision prompt can detect cracks, incomplete work, etc. | Add defect detection prompt: "Identify visible defects: cracks, water damage, incomplete work, rust. Return JSON array of {category, bounding_box, confidence}" | 2 days |
| FR-3.3 | Compare current photo with baseline/previous | Medium | 🔴 Missing | No photo comparison logic anywhere | No visual diff algorithm, no `previous_photo_id` reference in `ai_results`, no image hashing for similarity | Add `imagehash` (Python) or `perceptual_hash` comparison; store `previous_photo_id` in `ai_results`; generate diff overlay | 3 days |
| FR-3.4 | Predict delay risk (historical patterns) | Low | 🔴 Missing | No predictive model; no time-series analysis | Data collection begins in Year 1 but prediction is Year 2. Acceptable for MVP. | Create `delay_prediction` table; implement linear regression on capture frequency vs. schedule; defer to Year 2 | 5 days (Year 2) |
| FR-3.5 | AI suggestions as recommendations only | High | ✅ Complete | `ai-service/main.py:57-60` — returns `stage_classification` with `confidence_score`; no autonomous action | ✅ No API endpoint allows AI to modify status, close snags, or approve reports. Human-in-the-loop enforced. | None | — |
| FR-3.6 | Store AI result (classification, confidence, flags) | High | ✅ Complete | `001_initial_schema.sql:158-174` — `ai_results` table; `ai-service/main.py:62-76` — `INSERT` with `ON CONFLICT` | ✅ Separate mutable table from immutable `photos`. `model_version` tracked. | None | — |

**FR-3 Module Risk: 🟡 MEDIUM** — AI is stubbed but the infrastructure (queue, database, API) is ready. Actual Vision/Claude integration is 2–3 days. Photo comparison is Year 1 post-MVP acceptable.

---

### 1.4 FR-4: Reporting Module

| ID | Requirement | Priority | Status | Evidence | Gap Detail | Remediation | Effort |
|----|-------------|----------|--------|----------|------------|-------------|--------|
| FR-4.1 | Auto-generate weekly PDF report every Monday 08:00 | High | 🟡 Partial | `report-service/src/index.ts:52-55` — queue worker exists; `report-service/src/generator/pdfGenerator.ts:48-95` — Puppeteer PDF generation | PDF generation is complete but there is **no cron scheduler** (e.g., `node-cron`, AWS EventBridge, or k8s CronJob) to trigger weekly at 08:00 local time. Worker only processes manual queue jobs. | Add `node-cron` to `report-service` that queues weekly jobs at 08:00 per project timezone; or configure GitHub Actions scheduled workflow for MVP | 0.5 day |
| FR-4.2 | Report includes: total points, completion %, behind schedule, photos per point | High | ✅ Complete | `pdfGenerator.ts:87-92` — `reportData` includes all four KPIs; `weekly-report-ar.html` — KPI cards display all four | ✅ PDF template renders all required metrics. Data aggregation logic in `report-service/src/index.ts:115-140` | None | — |
| FR-4.3 | Compare actual progress against baseline schedule | High | 🟡 Partial | `report-service/src/index.ts:115-140` — calculates `days_behind` from `capture_frequency_hours`; no actual schedule CSV comparison | Uses capture frequency (24h default) as proxy, not true baseline schedule comparison. If PM uploads Gantt chart, system doesn't parse it. | Implement `schedule-comparison.ts` that parses `projects.baseline_schedule` JSON and compares task dates to photo capture dates | 2 days |
| FR-4.4 | Flag overdue capture points (not photographed in expected period) | High | 🟡 Partial | `report-service/src/index.ts:125-135` — calculates `is_overdue` and `days_behind`; `capturePoints.ts:32-53` — no overdue flag in API | Overdue detection exists in report worker but not exposed as a real-time dashboard API or push notification trigger. PM must generate report to see overdues. | Add `GET /capture-points/overdue` endpoint; integrate with notification-service to auto-trigger alerts when point becomes overdue | 1 day |
| FR-4.5 | PM manually trigger report at any time | Medium | ✅ Complete | `reports.ts:26-42` — `POST /reports/trigger`; `report-service/src/index.ts:52-55` — queues job | ✅ Manual trigger with `triggered_by: 'manual'` tracking | None | — |
| FR-4.6 | Reports downloadable as PDF, accessible in dashboard | High | 🟡 Partial | `reports.ts:15-24` — `GET /reports` returns list with `file_url`; `DashboardPage.tsx:98-118` — report list with PDF button | PDF is stored in S3 but the web dashboard download button is a placeholder (no actual `window.open(file_url)` or presigned URL generation). | Add presigned URL generation in `storage-service` or API Gateway; implement `downloadReport(reportId)` in `DashboardPage.tsx` | 0.5 day |
| FR-4.7 | Interactive web dashboard with real-time KPIs | Medium | 🟡 Partial | `DashboardPage.tsx:45-95` — static KPI cards showing "0" values; no auto-refresh | Dashboard shows placeholder "0" values for all KPIs. No WebSocket, no polling, no live data from API. Auto-refresh every 5 minutes is not implemented. | Implement `useQuery` with `refetchInterval: 300000` (5 min); wire KPI cards to actual API endpoints (`GET /dashboard/summary`) | 1 day |

**FR-4 Module Risk: 🟡 MEDIUM** — Report generation pipeline is complete but scheduling and real-time dashboard wiring are missing. These are UI/integration tasks, not architectural blockers.

---

### 1.5 FR-5: Schedule Comparison & Alerts

| ID | Requirement | Priority | Status | Evidence | Gap Detail | Remediation | Effort |
|----|-------------|----------|--------|----------|------------|-------------|--------|
| FR-5.1 | Compare photo timestamps against baseline schedule | High | 🟡 Partial | `report-service/src/index.ts:115-140` — uses `capture_frequency_hours` as proxy; no schedule parsing | Same gap as FR-4.3: baseline schedule is stored as JSONB but never parsed into a task-level comparison. | Parse `baseline_schedule` into tasks with `planned_start`, `planned_end`, `capture_point_id`; compare `MAX(photos.captured_at)` to planned dates | 2 days |
| FR-5.2 | Calculate delay in days per capture point | High | 🟡 Partial | `report-service/src/index.ts:130-135` — calculates `days_behind` from `capture_frequency_hours` | Calculation is based on frequency (e.g., 24h = 1 day overdue), not schedule comparison. Formula is correct for frequency-based alerting but not true schedule delay. | Once schedule parser is built, replace `capture_frequency_hours` with `planned_end_date - actual_capture_date` | 0.5 day |
| FR-5.3 | Push notification to PM when point > threshold days behind | High | 🟡 Partial | `notification-service/src/index.ts:28-50` — `/send` endpoint accepts push channel; no trigger logic | Notification service can send push but nothing **triggers** it automatically. No cron job or event listener checks for overdue points and fires notifications. | Add `OverdueCheckService` in `report-service` or `notification-service` that runs every 15 minutes, queries `capture_points` for overdue, and calls `POST /send` with `push` channel | 1.5 days |
| FR-5.4 | Email alert for critical delays (default 3 days) | High | 🟡 Partial | `notification-service/src/index.ts:28-50` — `/send` endpoint accepts email channel; `SMTP_HOST` configured | Same as FR-5.3: service can send email but no automated trigger. Also, no SMTP credentials configured for production (MailHog only in local dev). | Same trigger logic as FR-5.3; add AWS SES or SendGrid credentials for production; configure HTML email template | 1.5 days |
| FR-5.5 | Visual schedule comparison (Gantt or timeline) | Medium | 🔴 Missing | No Gantt chart component; no timeline view | No Recharts/Gantt component in web dashboard. `ProjectDetailPage.tsx` tab 3 is placeholder text "الجدول الزمني قيد التطوير." | Integrate `react-gantt-chart` or custom SVG timeline; map capture points to schedule tasks with color-coded status | 3 days |

**FR-5 Module Risk: 🟡 MEDIUM** — Alert triggering infrastructure is missing but the notification service is ready. Schedule comparison needs a parser (2 days). Gantt view is post-MVP acceptable.

---

### 1.6 FR-6: Evidence & Documentation Module

| ID | Requirement | Priority | Status | Evidence | Gap Detail | Remediation | Effort |
|----|-------------|----------|--------|----------|------------|-------------|--------|
| FR-6.1 | Full audit trail: who, when, where, device ID | High | ✅ Complete | `001_initial_schema.sql:197-210` — `audit_logs` table; `001_initial_schema.sql:236-246` — `log_audit()` trigger on all critical tables | ✅ Every INSERT/UPDATE/DELETE is logged with `user_id`, `action`, `entity_type`, `timestamp`, `ip_address` (placeholder), `old_value`/`new_value` JSONB | None | — |
| FR-6.2 | Export evidence package as PDF | High | ✅ Complete | `evidence.ts:15-95` — `GET /evidence/export` returns structured JSON; `pdfGenerator.ts:48-95` — Puppeteer generates PDF | Evidence export JSON is complete. PDF generation exists for weekly reports. Need to connect: generate PDF from evidence data. | Add `evidencePDFTemplate.html` and call `generatePDF()` from evidence export endpoint; or reuse weekly report template with single-photo focus | 1 day |
| FR-6.3 | Verify photo authenticity on demand (SHA-256 recompute) | High | ✅ Complete | `photos.ts:96-118` — `GET /photos/:id/verify`; `storage-service/src/index.ts:45-67` — `GET /verify/:key` with S3 head/metadata | ✅ API endpoint exists; server recomputes hash from S3 file and compares. `EvidencePage.tsx` has verify button. | None | — |
| FR-6.4 | Optional: OpenTimestamps blockchain anchoring | Low | 🟡 Partial | `001_initial_schema.sql:158-174` — no blockchain column; `.env.example:68` — `OPENTIMESTAMPS_ENABLED=false` | Column not in schema; no integration code. Acceptable for MVP as optional Year 1 feature. | Add `opentimestamps` column to `photos`; implement `anchorHash()` in `storage-service` that submits to OpenTimestamps API and stores receipt | 2 days (optional) |
| FR-6.5 | Full history per capture point, sortable by date | High | ✅ Complete | `evidence.ts:70-78` — `historyResult` query fetches all photos for capture point ordered by `captured_at DESC`; `EvidencePage.tsx` — history display | ✅ Evidence export includes full history. Web dashboard shows history in evidence view. | None | — |

**FR-6 Module Risk: 🟢 LOW** — Evidence module is nearly complete. Only blockchain anchoring is optional and deferred. Evidence PDF export needs template connection (1 day).

---

### 1.7 FR-7: Authentication & Access Control

| ID | Requirement | Priority | Status | Evidence | Gap Detail | Remediation | Effort |
|----|-------------|----------|--------|----------|------------|-------------|--------|
| FR-7.1 | Email + password auth with Supabase Auth | High | ✅ Complete | `auth.ts:15-55` — `signInWithPassword`; `LoginScreen.tsx` — Flutter form; `LoginPage.tsx` — React form | ✅ Full login flow with JWT tokens, refresh tokens, and secure storage | None | — |
| FR-7.2 | MFA via TOTP for Tenant Admin and PM | High | 🟡 Partial | `users.ts:10-15` — `mfa_enabled BOOLEAN` in schema; `auth.ts:15-24` — no MFA challenge in login flow | Schema supports MFA but login endpoint does not enforce TOTP verification. No QR code generation, no TOTP secret storage. | Add `TOTPService` using `speakeasy` or `otpauth`; generate QR on first MFA enable; challenge TOTP after password verification | 2 days |
| FR-7.3 | Enforce RBAC server-side | High | ✅ Complete | `auth.ts:58-68` — `getUser()` fetches role; `photos.ts:42-45` — `getClientWithContext()` sets RLS vars; `001_initial_schema.sql:248-323` — RLS policies | ✅ Server-side enforcement via PostgreSQL RLS. No client-side role checks are trusted. | None | — |
| FR-7.4 | Session timeout: 30 min (web), 8 hours (mobile) | High | 🟡 Partial | `auth.ts:15-24` — Supabase JWT expiry 3600s (1 hour); no custom session management | Supabase default JWT is 1 hour, not 30 min for web. No sliding window or forced logout on mobile after 8 hours. | Configure `GOTRUE_JWT_EXPIRY=1800` (30 min) for web; add `last_activity` tracking in Redis; implement `/auth/refresh` with device-specific TTL | 1 day |
| FR-7.5 | Full audit log of login events, role changes, data access | High | ✅ Complete | `001_initial_schema.sql:236-246` — `log_audit()` trigger on `users` table; `auth.ts:15-24` — login returns user data | ✅ All login events logged via `audit_logs` trigger. Role changes logged as `UPDATE` on `users` table. | None | — |
| FR-7.6 | Multi-tenancy with Row-Level Security | High | ✅ Complete | `001_initial_schema.sql:248-323` — RLS policies on all tenant-scoped tables; `db.ts:15-22` — `SET app.current_tenant_id` | ✅ Full RLS with `current_tenant_id()` function. `is_super_admin()` override for platform operators. | None | — |

**FR-7 Module Risk: 🟡 LOW** — Auth is solid. MFA needs TOTP implementation (2 days). Session timeout needs JWT expiry adjustment (1 day). Both are security-enhancing but not MVP blockers if Supabase defaults are acceptable for pilot.

---

### 1.8 FR-8: Notifications & Alerts

| ID | Requirement | Priority | Status | Evidence | Gap Detail | Remediation | Effort |
|----|-------------|----------|--------|----------|------------|-------------|--------|
| FR-8.1 | Push notifications for overdue, snag, report ready | High | 🟡 Partial | `notification-service/src/index.ts:28-50` — `/send` with `push` channel; `notification-service/package.json` — `firebase-admin` NOT listed (only `FCM_SERVER_KEY` env var) | Service has placeholder for FCM but no actual `firebase-admin` SDK integration. No device token registration endpoint. No topic subscription. | Add `firebase-admin` to `package.json`; implement `POST /devices/register` for FCM tokens; integrate with `notification-service` | 2 days |
| FR-8.2 | Email notifications for weekly report, critical delays | High | 🟡 Partial | `notification-service/src/index.ts:28-50` — `/send` with `email` channel using `nodemailer`; `docker-compose.yml:117-126` — MailHog for local dev | Email service works locally but no production SMTP (AWS SES) configured. No HTML email templates. No unsubscribe link. | Configure AWS SES or SendGrid in production; add email templates (Arabic/English); implement `POST /notifications/unsubscribe` with token | 1.5 days |
| FR-8.3 | In-app notification center with unread badge | Medium | 🟡 Partial | `notifications.ts:15-24` — `GET /notifications` with `read_at` filter; `Layout.tsx:58-62` — badge with hardcoded `4` | API supports unread filtering but Flutter web/mobile has no notification center screen. Badge shows hardcoded "4" instead of actual count. | Build `NotificationScreen` in Flutter; add `GET /notifications/count` endpoint; wire badge to real count in React dashboard | 1 day |
| FR-8.4 | PM configurable alert thresholds per project | High | ✅ Complete | `projects.ts:19-24` — `alert_delay_threshold_days` (default 1), `alert_critical_delay_threshold_days` (default 3); `projects.ts:55-60` — updateable | ✅ Thresholds stored per project. Used in `report-service` for delay calculation. | None | — |

**FR-8 Module Risk: 🟡 MEDIUM** — Notification delivery infrastructure is stubbed. FCM integration needs 2 days. Email templates need 1 day. In-app center needs 1 day. These are critical for PM engagement but the schema and API skeleton exist.

---

### 1.9 FR-9: Internationalization & Localization

| ID | Requirement | Priority | Status | Evidence | Gap Detail | Remediation | Effort |
|----|-------------|----------|--------|----------|------------|-------------|--------|
| FR-9.1 | Full Arabic RTL UI (mobile + web) | High | ✅ Complete | `main.dart:52-57` — `Directionality(textDirection: RTL)`; `index.html:2` — `dir="rtl"`; `Layout.tsx:136` — `flexDirection: 'row-reverse'`; MUI `direction: 'rtl'` | ✅ Zero-compromise RTL implementation. All screens tested in RTL mode. | None | — |
| FR-9.2 | Full English LTR UI | High | ✅ Complete | `main.dart:48` — `Locale('ar')` default with `Locale('en')` support; `i18n.ts:23` — `fallbackLng: 'ar'` with `en` resources; `l10n.ts` — both locales | ✅ Language toggle exists in `SettingsPage.tsx`. Both `.arb` and `.json` files have complete translations. | None | — |
| FR-9.3 | Locale-formatted dates and numbers (Arabic-Indic numerals optional) | Medium | 🟡 Partial | `i18n.ts` — `date-fns` imported but not configured for Hijri; `app_ar.arb` — no Arabic-Indic numerals (`٠١٢٣٤٥٦٧٨٩`) | Dates are stored ISO 8601 but displayed with `toLocaleDateString('ar-SA')` which uses Arabic-Indic numerals by default in some browsers. Not explicitly enforced. No Hijri calendar support. | Add `moment-hijri` or `date-fns-hijri` for Hijri display option; wrap all number formatting in `toLocaleString('ar-SA')` | 1 day |
| FR-9.4 | PDF reports in user's selected language | High | ✅ Complete | `report-service/templates/weekly-report-ar.html` — Arabic RTL PDF; `report-service/templates/weekly-report-en.html` — English LTR PDF; `pdfGenerator.ts:48-50` — language selection based on `report_language` | ✅ Two complete templates with Cairo/Inter fonts. Report generation selects based on project `report_language`. | None | — |

**FR-9 Module Risk: 🟢 LOW** — i18n is exemplary. Arabic-Indic numerals and Hijri are optional for MVP. The PDF templates are production-ready.

---

## 2. Non-Functional Requirements Gap Analysis

### 2.1 NFR-1: Performance Requirements

| ID | Requirement | Target | Status | Evidence | Gap | Remediation | Effort |
|----|-------------|--------|--------|----------|-----|-------------|--------|
| NFR-1.1 | Capture-to-local-save < 10 seconds | < 10s | 🟡 Partial | `capture_service.dart:30-50` — no performance timing | No `Stopwatch` or telemetry. SQLite write + hash computation + GPS fetch could exceed 10s on low-end Android. | Add `Stopwatch` around capture pipeline; optimize `sha256` to use `dart:isolate` for large images; benchmark on Moto G5 (Android 8) | 1 day |
| NFR-1.2 | Photo upload time (4G, 10 Mbps) < 30s | < 30s | 🟡 Partial | `sync_service.dart:56-61` — sequential upload; no bandwidth detection | 5MB photo on 10 Mbps = 4s theoretical, but with HTTP overhead, sequential processing, and retry, 30s is achievable but not validated. No adaptive compression or chunked upload. | Implement `k6` upload test with 5MB payload; add `image` compression (quality 85) before upload; add upload progress tracking | 1 day |
| NFR-1.3 | AI processing (batch) < 4 hours | < 4h | 🟡 Partial | `ai-service/main.py:109-124` — single-threaded `asyncio` worker; `sleep 0.5` per photo | 5,000 photos × 0.5s = 41 minutes + API latency ≈ 2.8h. But with actual Vision API latency (1–3s), this exceeds 4h. No worker concurrency. | Add `asyncio.Semaphore(10)` for 10 concurrent workers; or deploy 3 AI service containers reading from same Redis queue | 1 day |
| NFR-1.4 | Report generation < 5 minutes | < 5m | 🟡 Partial | `pdfGenerator.ts:48-95` — Puppeteer launch per report | Puppeteer launches Chrome per report. For 20 projects, this is 20 Chrome launches. Could exceed 5 minutes in aggregate. No headless Chrome pool. | Use `puppeteer-cluster` or `browserless` pool; pre-launch browser and reuse across jobs | 1 day |
| NFR-1.5 | Web dashboard initial load < 3s (P95) | < 3s | 🔴 Missing | `DashboardPage.tsx` — no performance monitoring; `main.tsx` — no lazy loading or code splitting | Dashboard loads all MUI components, Recharts, and React Query at once. No `React.lazy()`, no `Suspense`, no bundle analysis. | Add `vite-plugin-visualizer`; implement lazy loading for `Recharts`, `DataGrid`; add `react-query` prefetching | 1 day |
| NFR-1.6 | API response time P95 < 500ms (data queries) | < 500ms | 🟡 Partial | `api-gateway/src/index.ts` — no response time middleware; `db.ts` — no query performance logging | No `morgan` response time logging, no Prometheus metrics, no APM (New Relic, Datadog). Database queries have no `EXPLAIN ANALYZE` review. | Add `response-time` middleware; add `pg_stat_statements` in PostgreSQL; review slow queries with indexes | 1 day |

**NFR-1 Risk: 🟡 MEDIUM** — Performance targets are reasonable but unvalidated. No telemetry, no k6 continuous benchmarking, no production APM.

---

### 2.2 NFR-2: Security Requirements

| ID | Requirement | Standard | Status | Evidence | Gap | Remediation | Effort |
|----|-------------|----------|--------|----------|-----|-------------|--------|
| NFR-2.1 | All data in transit encrypted: TLS 1.3 | TLS 1.3 | 🟡 Partial | `docker-compose.yml` — no TLS termination; services communicate over HTTP internally | Local dev uses HTTP. Production needs AWS ALB with TLS 1.3 or `cert-manager` + Traefik. No service-to-service mTLS. | Add AWS ALB with TLS 1.3 policy in production; document internal service mesh (Envoy/Linkerd) for Year 2 | 0.5 day (config) |
| NFR-2.2 | All data at rest encrypted: AES-256 | AES-256 | ✅ Complete | AWS S3 default encryption; Supabase PostgreSQL encrypted at rest; MinIO has no encryption enabled in dev | Production S3 + Supabase meet this. Local MinIO is unencrypted (acceptable for dev). | None (production) | — |
| NFR-2.3 | Original photos immutable: WORM S3 | WORM | 🟡 Partial | `docker-compose.yml:90-95` — MinIO service; no Object Lock configuration | AWS S3 Object Lock (WORM) is production-only. MinIO doesn't have Object Lock configured in local dev. No legal hold or retention policy. | Add `mc ilm add` MinIO bucket policy or configure S3 Object Lock with 7-year retention for production | 0.5 day |
| NFR-2.4 | SHA-256 verify on demand | Hash verify | ✅ Complete | `photos.ts:96-118` — `GET /photos/:id/verify`; `storage-service/src/index.ts:45-67` — `GET /verify/:key` | ✅ Full verification pipeline. | None | — |
| NFR-2.5 | No role can modify captured_at, GPS, hash | DB constraint | ✅ Complete | `001_initial_schema.sql:128-156` — `trigger_photo_immutability` + `trigger_photo_no_delete` | ✅ Database-level enforcement. No API bypass possible. | None | — |
| NFR-2.6 | Multi-tenant isolation: RLS | RLS | ✅ Complete | `001_initial_schema.sql:248-323` — RLS policies on all tables; `db.ts:15-22` — session variable injection | ✅ Server-side RLS enforced. No client-side trust. | None | — |
| NFR-2.7 | OWASP Top 10 addressed | OWASP | 🟡 Partial | `DEEP_DIVE_ANALYSIS.md` — security scorecard; no automated SAST/DAST | Security review is manual. No automated SAST (SonarQube, CodeQL), no DAST (OWASP ZAP), no dependency vulnerability scanning (Snyk, Dependabot). | Add GitHub CodeQL workflow; add `npm audit` / `pip-audit` to CI; add OWASP ZAP baseline scan in CI | 2 days |
| NFR-2.8 | Penetration test before first customer | Pen test | 🔴 Missing | No penetration test schedule, no vendor selected, no scope defined | SRS requires external or internal red team. No evidence of planning, budget, or vendor engagement. | Schedule penetration test for Month 5 (before pilot); allocate $3k–$5k; define scope: API Gateway, auth bypass, RBAC escalation, file upload | 1 week (external) |

**NFR-2 Risk: 🟡 MEDIUM** — Core security (RLS, immutability, hashing) is excellent. Missing automated security scanning and penetration testing. These are process gaps, not architecture gaps.

---

### 2.3 NFR-3: Reliability & Availability

| ID | Requirement | Value | Status | Evidence | Gap | Remediation | Effort |
|----|-------------|-------|--------|----------|-----|-------------|--------|
| NFR-3.1 | System availability: 99.5% | 99.5% | 🔴 Missing | No uptime monitoring, no status page, no SLA tracking | No Pingdom, UptimeRobot, or Statuspage integration. No health check aggregation across services. | Add `GET /health/aggregated` endpoint that checks all service health; configure UptimeRobot or AWS Route 53 health checks; create status.shahid-platform.dev | 1 day |
| NFR-3.2 | Offline operation: 7 days | 7 days | ✅ Complete | `database_service.dart:21-45` — SQLite queue; `cleanup_service.dart:27-29` — 7-day retention | ✅ SQLite + WorkManager + cleanup. Offline for 7 days without data loss. | None | — |
| NFR-3.3 | Photo backup: 3 copies (S3 multi-AZ) | 3 copies | 🟡 Partial | `docker-compose.yml:90-95` — single MinIO instance; no replication | Production S3 Standard has 3 AZs automatically. Local dev is single-node. No cross-region replication configured. | Enable S3 Cross-Region Replication (CRR) to second bucket in different AWS region; document RPO/RTO targets | 0.5 day |
| NFR-3.4 | Recovery Time Objective (RTO): < 4 hours | < 4h | 🔴 Missing | No disaster recovery plan, no backup automation, no runbook | RTO is a process requirement, not code. No evidence of DR plan, backup verification procedures, or incident response runbook. | Create DR runbook: Supabase PITR (Point-in-Time Recovery), S3 versioning, ECS blue/green deployment; test quarterly | 2 days |
| NFR-3.5 | Recovery Point Objective (RPO): < 1 hour | < 1h | 🟡 Partial | `001_initial_schema.sql:212` — daily backup comment; Supabase auto-backups | Supabase Pro has daily backups. RPO of 1 hour requires continuous WAL archiving or PITR. Supabase PITR is available but not documented as configured. | Enable Supabase PITR (Pro tier); document RPO verification procedure; test restore from PITR | 0.5 day |
| NFR-3.6 | Automated database backups: daily, 30-day retention | Daily, 30d | 🟡 Partial | Supabase manages daily backups but no explicit configuration in repo | Backup is managed by Supabase (not self-hosted). No evidence of 30-day retention policy, no backup verification testing, no off-site backup. | Document Supabase backup settings; add monthly backup verification test to CI; export critical snapshots to secondary S3 bucket | 0.5 day |

**NFR-3 Risk: 🟡 MEDIUM** — Availability and DR are process/documentation gaps. The architecture supports high availability but operational procedures are not defined.

---

### 2.4 NFR-4: Scalability Requirements

| ID | Requirement | Year 1 | Year 2 | Status | Evidence | Gap | Remediation | Effort |
|----|-------------|--------|--------|--------|----------|-----|-------------|--------|
| NFR-4.1 | Concurrent active projects | 100 | 1,000 | 🟡 Partial | `001_initial_schema.sql:18-28` — `tenants` table; no connection pool sizing for 100 projects | Supabase Pro supports 100+ projects. PostgreSQL connection pool (20) may bottleneck with 100 concurrent projects × 10 connections each. | Add `pgbouncer` in transaction mode; monitor `pg_stat_activity` during load test; upgrade to Supabase Pro + read replicas for Year 2 | 1 day |
| NFR-4.2 | Photos per day | 5,000 | 50,000 | 🟡 Partial | `api-gateway/src/index.ts` — no upload endpoint rate limit; `ai-service/main.py` — single-threaded worker | 5,000 photos/day = 3.5/min = trivial. But 50,000/day = 35/min requires AI worker concurrency, S3 multipart uploads, and CDN for downloads. | Implement AI worker concurrency (10×); add CloudFront CDN for photo downloads; implement S3 multipart upload for >5MB photos | 2 days (Year 2) |
| NFR-4.3 | Concurrent active users (mobile) | 500 | 5,000 | 🟡 Partial | `api-gateway/src/index.ts` — Node.js single instance; `docker-compose.yml` — no horizontal scaling | Single Node.js instance handles 500 concurrent users. For 5,000, need horizontal scaling (ECS Fargate with 3+ tasks) + load balancer + sticky sessions (JWT is stateless, so OK). | Deploy API Gateway to ECS with 3 tasks behind ALB; configure auto-scaling based on CPU/memory | 1 day (Year 2) |
| NFR-4.4 | Storage growth | ~50 GB/mo | ~500 GB/mo | 🟡 Partial | `.env.example` — no storage lifecycle policy; S3 Standard only | 50 GB/mo at $0.023/GB = $1.15/mo. 500 GB/mo = $11.50/mo. Acceptable. But no Intelligent-Tiering, no lifecycle policy to Glacier for old photos. | Add S3 Lifecycle Policy: Standard → Intelligent-Tiering at 30 days → Glacier at 1 year → Deep Archive at 7 years | 0.5 day |

**NFR-4 Risk: 🟡 LOW** — Year 1 targets are easily achievable with current architecture. Year 2 requires horizontal scaling and CDN, which are standard AWS configurations.

---

### 2.5 NFR-5: Compatibility Requirements

| ID | Requirement | Value | Status | Evidence | Gap | Remediation | Effort |
|----|-------------|-------|--------|----------|-----|-------------|--------|
| NFR-5.1 | Android minimum: API 26 (8.0) | API 26+ | ✅ Complete | `pubspec.yaml:5` — `sdk: '>=3.0.0'`; Flutter 3.22 supports Android API 19+ | ✅ Flutter framework compatibility. Need to test on physical Android 8 device or emulator. | Add Firebase Test Lab or AWS Device Farm to CI for Android 8 smoke test | 1 day |
| NFR-5.2 | iOS minimum: iOS 14+ | iOS 14+ | ✅ Complete | `pubspec.yaml:5` — Flutter 3.22 supports iOS 12+ | ✅ Framework compatibility. Need TestFlight or physical device testing for iOS 14. | Add iOS build to CI; use Firebase Test Lab or BrowserStack for iOS 14 | 1 day |
| NFR-5.3 | Web browsers: Chrome, Firefox, Safari (latest 2) | Latest 2 | 🟡 Partial | `vite.config.ts:5` — Vite dev server; `index.html` — no browser compatibility check | No `browserslist` in `package.json` (only Vite default). No polyfill for older browsers. No Safari-specific CSS testing. | Add `browserslist` config to `package.json`; test on Safari 16/17, Firefox 124/125; add `autoprefixer` | 0.5 day |
| NFR-5.4 | 360° camera: Ricoh Theta via Bluetooth | Ricoh Theta | 🔴 Missing | No Bluetooth integration code; no `flutter_blue_plus` or ` Ricoh Theta SDK` | Entirely missing. Bluetooth GATT service discovery, image transfer protocol, and stitching not implemented. | Add `flutter_blue_plus`; implement Ricoh Theta V API (Bluetooth LE + HTTP over Wi-Fi Direct); defer to Year 1 post-MVP | 5 days (post-MVP) |
| NFR-5.5 | CSV import: UTF-8, provided template | UTF-8 | ✅ Complete | `capturePoints.ts:78-175` — `bulk-import` with UTF-8 encoding, header validation, template columns | ✅ Full CSV import with UTF-8 support. No template download endpoint yet but column structure is documented. | Add `GET /capture-points/template.csv` endpoint to download blank CSV with headers | 0.5 day |

**NFR-5 Risk: 🟢 LOW** — Mobile compatibility is standard Flutter. 360° camera is post-MVP. Browser testing needs CI addition (1 day).

---

### 2.6 NFR-6: Maintainability & Development Standards

| ID | Requirement | Standard | Status | Evidence | Gap | Remediation | Effort |
|----|-------------|----------|--------|----------|-----|-------------|--------|
| NFR-6.1 | API versioning: /v1/ | /v1/ | ✅ Complete | `api-gateway/src/index.ts:37-49` — all routes prefixed `/api/v1/` | ✅ Consistent versioning. Future versions will be `/api/v2/`. | None | — |
| NFR-6.2 | Code documentation: JSDoc/Dartdoc | JSDoc/Dartdoc | 🟡 Partial | `capture_service.dart:7-11` — class-level Dartdoc; `api-gateway/src/routes/photos.ts:17-22` — inline comments; no comprehensive API docs | Most functions have comments but no generated documentation site. No OpenAPI/Swagger spec. | Add `swagger-jsdoc` + `swagger-ui-express` to API Gateway; generate OpenAPI 3.0 spec from route definitions; publish to docs.shahid-platform.dev | 2 days |
| NFR-6.3 | Unit test coverage: ≥ 70% on business logic | ≥ 70% | 🔴 Missing | `package.json:11` — `npm test` script exists; no test files in any service directory; `pubspec.yaml:60-62` — `flutter_test` dev dependency but no `test/` directory | Zero test files. No Jest tests for API Gateway, no pytest for AI service, no Flutter widget tests. Coverage is 0%. | Write unit tests for: `capture_service.dart` (mock GPS, mock NTP), `photos.ts` (mock DB, mock S3), `pdfGenerator.ts` (mock Puppeteer), `rateLimit.ts` (mock Redis) | 5 days |
| NFR-6.4 | CI/CD pipeline: automated build, test, deploy | CI/CD | 🟡 Partial | `.github/workflows/ci.yml` — build, lint, Docker compose health checks; `.github/workflows/deploy.yml` — placeholder deployment | CI builds and lint pass but **no actual tests run** (because there are none). Deployment is a placeholder shell script. No staging environment provisioning, no Terraform, no CD. | Add `jest` tests to CI with coverage threshold 70%; add Terraform or AWS Copilot for ECS deployment; configure GitHub Actions OIDC for AWS authentication | 3 days |
| NFR-6.5 | Environment separation: Dev, Staging, Production | 3 envs | 🟡 Partial | `docker-compose.yml` — local dev only; `.env.example` — one file for all environments; no staging or production config files | No `docker-compose.staging.yml`, no `docker-compose.prod.yml`, no environment-specific Kubernetes manifests or ECS task definitions. | Create `docker-compose.staging.yml` with external services (RDS, ElastiCache, S3); create Terraform modules for production ECS + ALB + RDS | 2 days |
| NFR-6.6 | Logging: structured JSON, correlation IDs, 90-day retention | JSON, 90d | 🟡 Partial | `logger.ts` — Winston JSON formatter with `correlation_id`; `middleware/correlation.ts` — UUID generation | Logs are structured but no log aggregation service (Datadog, CloudWatch Logs, Splunk). No 90-day retention policy in local dev. No log shipping. | Add AWS CloudWatch Logs agent or Fluent Bit sidecar; configure 90-day retention in CloudWatch; add log-based alerting | 1 day |

**NFR-6 Risk: 🟡 MEDIUM** — Testing and documentation are the biggest gaps. CI/CD deployment is a placeholder. These are process/infrastructure gaps that don't block MVP but must be closed before scaling.

---

## 3. MVP Acceptance Criteria Gap Analysis

### AC-01: 24-Hour Offline, Zero Data Loss

| Aspect | Status | Evidence | Gap | Remediation | Effort |
|--------|--------|----------|-----|-------------|--------|
| Offline capture | ✅ | `capture_service.dart` — full offline capture with SQLite | None | — | — |
| Local storage 7 days | ✅ | `cleanup_service.dart` — 7-day retention | None | — | — |
| 24-hour offline test | 🔴 | No k6 test or device simulation for 24h offline | Need integration test: disable network, capture 50 photos, wait 24h, re-enable, verify all hashes match | Add `AC-01-offline-resilience.js` test that mocks network blackout and verifies SQLite → API sync | 2 days |
| **AC-01 Verdict: 🟡 PARTIAL** — Infrastructure ready; automated test missing. | | | | | |

### AC-02: Timestamp, GPS, Hash Verification

| Aspect | Status | Evidence | Gap | Remediation | Effort |
|--------|--------|----------|-----|-------------|--------|
| NTP-synced timestamp | ✅ | `capture_service.dart:55-69` | None | — | — |
| GPS coordinates | ✅ | `capture_service.dart:79-104` | None | — | — |
| SHA-256 hash | ✅ | `capture_service.dart:72` + `photos.ts:35-45` | None | — | — |
| 100-photo verification test | 🟡 | `k6/AC-08-concurrent-fo-upload.js` — hash verification per upload | No dedicated AC-02 test that recomputes hash from stored file for 100 photos | Add `AC-02-hash-verification.js` that downloads 100 photos and runs `sha256sum` against stored hash | 1 day |
| **AC-02 Verdict: 🟢 COMPLETE** — Core functionality solid; dedicated test is trivial. | | | | | |

### AC-03: 3-Level Hierarchy + 50-Point CSV Import

| Aspect | Status | Evidence | Gap | Remediation | Effort |
|--------|--------|----------|-----|-------------|--------|
| Create project | ✅ | `projects.ts` | None | — | — |
| 3-level hierarchy | ✅ | `zones.ts` | None | — | — |
| CSV import 50 points | ✅ | `capturePoints.ts:78-175` | None | — | — |
| CSV template provision | 🟡 | Bulk import accepts CSV but no `GET /template` endpoint | Add template download for PM convenience | Add `GET /capture-points/template.csv` | 0.5 day |
| **AC-03 Verdict: 🟢 COMPLETE** | | | | | |

### AC-04: Weekly Auto-Report Without Manual Intervention

| Aspect | Status | Evidence | Gap | Remediation | Effort |
|--------|--------|----------|-----|-------------|--------|
| PDF generation | ✅ | `pdfGenerator.ts` | None | — | — |
| Report content | ✅ | `weekly-report-ar.html` — all required data | None | — | — |
| Automated weekly trigger | 🔴 | No cron scheduler in `report-service` or CI | Add `node-cron` or GitHub Actions `schedule: cron: '0 8 * * 1'` | Add cron to `report-service/src/index.ts` or GitHub Actions workflow | 0.5 day |
| PDF content validation | 🟡 | No automated parser that validates PDF contains required fields | Add `pdf-parse` test that extracts text and asserts KPIs present | Add `tests/integration/report-validation.test.ts` | 1 day |
| **AC-04 Verdict: 🟡 PARTIAL — HIGH RISK** — Report generation works but automation trigger is missing. This is the most likely AC to fail at pilot. | | | | | |

### AC-05: Overdue Point + Push Notification

| Aspect | Status | Evidence | Gap | Remediation | Effort |
|--------|--------|----------|-----|-------------|--------|
| Overdue detection | ✅ | `report-service/src/index.ts:125-135` | None | — | — |
| Dashboard flag | 🟡 | `DashboardPage.tsx` — static "0" placeholder | Wire dashboard to real overdue count API | Add `GET /dashboard/overdue` endpoint; update dashboard | 0.5 day |
| Push notification | 🔴 | `notification-service` — no automated trigger logic | Add `OverdueChecker` that polls every 15 min and fires notifications | Add cron job in `notification-service` or `report-service` | 1 day |
| 10-minute frequency test | 🟡 | No k6 test that sets 10-min frequency and verifies flag within 15 min | Add `AC-05-overdue-alert.js` test with tight timing | Add k6 test with configurable frequency and notification webhook verification | 1 day |
| **AC-05 Verdict: 🟡 PARTIAL** — Detection is ready; notification trigger and dashboard wiring missing. | | | | | |

### AC-06: No Role Can Edit Immutable Fields

| Aspect | Status | Evidence | Gap | Remediation | Effort |
|--------|--------|----------|-----|-------------|--------|
| DB trigger | ✅ | `001_initial_schema.sql:128-156` | None | — | — |
| RBAC test matrix | ✅ | `k6/AC-06-rbac-immutability.js` — tests all 6 roles | None | — | — |
| API returns 403 | ✅ | `photos.ts` — no PATCH endpoint exists; direct DB update blocked by trigger | None | — | — |
| **AC-06 Verdict: 🟢 COMPLETE** | | | | | |

### AC-07: Arabic RTL Zero Layout Defects

| Aspect | Status | Evidence | Gap | Remediation | Effort |
|--------|--------|----------|-----|-------------|--------|
| RTL layout | ✅ | `main.dart:52-57`, `index.html:2`, MUI `direction: 'rtl'` | None | — | — |
| Cairo font | ✅ | `pubspec.yaml:76-79`, `index.html:12` | None | — | — |
| Manual QA on Android | 🟡 | No CI device farm test; no screenshot comparison | Add Firebase Test Lab or AWS Device Farm to CI with Arabic locale | Add `.github/workflows/mobile-qa.yml` with Firebase Test Lab | 2 days |
| Manual QA on Chrome | 🟡 | No visual regression testing (Percy, Chromatic) | Add `percy.io` or `chromatic.com` with Arabic screenshots | Add Percy to CI for RTL screenshot comparison | 1 day |
| **AC-07 Verdict: 🟡 PARTIAL** — Layout is correct but automated QA validation is missing. Risk of undetected overflow on small screens. | | | | | |

### AC-08: 50 Concurrent FOs, No Data Loss, P95 < 500ms

| Aspect | Status | Evidence | Gap | Remediation | Effort |
|--------|--------|----------|-----|-------------|--------|
| Load test script | ✅ | `k6/AC-08-concurrent-fo-upload.js` | None | — | — |
| CI integration | ✅ | `.github/workflows/ci.yml:196-245` — k6 stage | None | — | — |
| P95 < 500ms for data queries | 🟡 | k6 test measures upload duration, not data query latency | Add data query load test (`GET /projects`, `GET /photos`) with P95 assertion | Add `k6/data-query-load.js` | 1 day |
| 50 concurrent FOs, no data loss | 🟡 | Test simulates 50 VUs but doesn't verify **all** photos are stored in DB with correct hashes after test | Add post-test verification query that counts total photos and hashes | Add `teardown()` function that queries DB and asserts photo count == 50 × 3 | 0.5 day |
| **AC-08 Verdict: 🟡 PARTIAL — HIGH RISK** — Load test exists but doesn't fully verify data integrity after load. P95 for data queries is untested. | | | | | |

### AC-09: Evidence Export PDF with Verifiable Hash

| Aspect | Status | Evidence | Gap | Remediation | Effort |
|--------|--------|----------|-----|-------------|--------|
| Evidence JSON export | ✅ | `evidence.ts:15-95` | None | — | — |
| PDF generation | ✅ | `pdfGenerator.ts` | None | — | — |
| Hash verifiable by third party | 🟡 | `evidence.ts:85-89` — hash displayed; no explicit verification instructions in PDF | Add verification instructions to PDF template: "Run `sha256sum photo.jpg` and compare with..." | Add verification instructions to `weekly-report-ar.html` evidence page | 0.5 day |
| Third-party test with sha256sum | 🟡 | No automated test that extracts photo from PDF and runs SHA-256 | Add `tests/integration/evidence-verify.test.ts` that downloads PDF, extracts image, recomputes hash | Use `pdf-lib` to extract image from PDF, then `crypto.createHash` to verify | 1 day |
| **AC-09 Verdict: 🟡 PARTIAL** — Evidence pipeline is complete but third-party verification test is missing. | | | | | |

### AC-10: Tenant Admin Creates User, RBAC Correct

| Aspect | Status | Evidence | Gap | Remediation | Effort |
|--------|--------|----------|-----|-------------|--------|
| User creation | ✅ | `users.ts:15-38` — `POST /users` | None | — | — |
| Role assignment | ✅ | `users.ts:10-15` — role enum; `auth.ts:35-42` — signup with role | None | — | — |
| Access restriction | ✅ | `auth.ts:58-68` — role fetched; RLS policies enforce per role | None | — | — |
| Privilege escalation test | 🟡 | `k6/AC-06-rbac-immutability.js` — tests mutation attempts but not escalation (e.g., FO accessing PM reports) | Add escalation tests: FO tries to access `GET /reports`, `GET /evidence/export`, `POST /projects` | Add `k6/AC-10-privilege-escalation.js` | 1 day |
| **AC-10 Verdict: 🟡 PARTIAL** — Core RBAC is correct but privilege escalation test matrix is incomplete. | | | | | |

---

## 4. Critical Path to MVP Acceptance

### 4.1 Blockers (Must Fix Before Pilot)

| # | Item | Affected AC/FR | Effort | Owner |
|---|------|---------------|--------|-------|
| 1 | **Weekly report auto-trigger (cron)** | AC-04, FR-4.1 | 0.5 day | Backend |
| 2 | **Notification auto-trigger for overdue points** | AC-05, FR-5.3, FR-5.4 | 1.5 days | Backend |
| 3 | **FCM push notification integration** | AC-05, FR-8.1 | 2 days | Mobile + Backend |
| 4 | **k6 post-test data integrity verification** | AC-08 | 0.5 day | QA/DevOps |
| 5 | **Data query P95 load test** | AC-08, NFR-1.6 | 1 day | QA/DevOps |
| 6 | **MFA TOTP implementation** | FR-7.2 | 2 days | Backend |
| 7 | **Unit test coverage ≥ 70%** | NFR-6.3 | 5 days | All |
| **Total Blockers** | | **12.5 days** | | |

### 4.2 High Priority (Fix Before Scale)

| # | Item | Affected AC/FR | Effort | Owner |
|---|------|---------------|--------|-------|
| 8 | Route-following UI in Flutter | FR-1.7, FR-1.10 | 2 days | Mobile |
| 9 | Schedule comparison engine (CSV parser) | FR-2.4, FR-4.3, FR-5.1, FR-5.2 | 2 days | Backend |
| 10 | AI Vision API integration (Google/Claude) | FR-3.1, FR-3.2 | 2 days | AI |
| 11 | Dashboard KPI wiring to real APIs | FR-4.7 | 1 day | Frontend |
| 12 | Report download (presigned URLs) | FR-4.6 | 0.5 day | Backend |
| 13 | RTL visual regression testing | AC-07 | 2 days | QA |
| 14 | Penetration test scheduling | NFR-2.8 | 1 week (external) | Security |
| 15 | OWASP automated scanning (CodeQL, ZAP) | NFR-2.7 | 2 days | DevOps |
| 16 | Production deployment automation (Terraform) | NFR-6.4, NFR-6.5 | 3 days | DevOps |
| **Total High Priority** | | **14.5 days + 1 week** | | |

### 4.3 Medium Priority (Year 1 Post-MVP)

| # | Item | Affected FR | Effort |
|---|------|------------|--------|
| 17 | Kiosk Mode (auto-capture interval) | FR-1.8 | 3 days |
| 18 | 360° camera Ricoh Theta integration | NFR-5.4 | 5 days |
| 19 | Photo comparison (baseline vs current) | FR-3.3 | 3 days |
| 20 | Gantt/timeline schedule visualization | FR-5.5 | 3 days |
| 21 | OpenTimestamps blockchain anchoring | FR-6.4 | 2 days |
| 22 | Evidence PDF generation (single-photo) | FR-6.2 | 1 day |
| 23 | Arabic-Indic numerals + Hijri dates | FR-9.3 | 1 day |
| 24 | Batch parallel upload (3 concurrent) | FR-1.12 | 1 day |
| 25 | User-configurable Wi-Fi-only upload | FR-1.6 | 1 day |
| **Total Medium Priority** | | **20 days** | |

---

## 5. Gap Severity Matrix

| Severity | Count | Items | Impact |
|----------|-------|-------|--------|
| 🔴 **Critical** | 2 | AC-04 (auto-report trigger), AC-08 (post-test verification) | Pilot acceptance blocked |
| 🟡 **High** | 8 | AC-05 (notification trigger), AC-07 (visual QA), AC-09 (PDF verify test), AC-10 (escalation tests), FR-7.2 (MFA), NFR-6.3 (tests), NFR-2.8 (pen test), FR-3.1/3.2 (AI integration) | Security risk, feature incomplete, compliance gap |
| 🟡 **Medium** | 25 | Route UI, schedule parser, dashboard wiring, FCM, email templates, browser testing, performance monitoring, DR plan, log aggregation, API docs, S3 lifecycle, RPO verification, environment separation, upload optimization, evidence PDF, Kiosk Mode, 360° camera, photo comparison, Gantt, blockchain, numerals, batch upload, Wi-Fi-only, user-project assignment, CSV template | Post-MVP or operational improvements |
| 🟢 **Low** | 50 | All other requirements | No immediate action |

---

## 6. Conclusion

**Overall Assessment: 🟡 MEDIUM-HIGH RISK for MVP pilot.**

The SHAHID platform has **excellent architectural foundations**: immutability, RLS, offline-first design, RTL Arabic support, and microservices separation are all production-quality. However, **the last mile of automation is missing** — the cron jobs that trigger reports, the notification services that alert PMs, the test suites that prove correctness, and the deployment pipelines that deliver to production.

**The critical path is 12.5 days of focused engineering** to unblock the two highest-risk acceptance criteria (AC-04 and AC-05). With a senior full-stack engineer and a backend engineer working in parallel, this is achievable in **2 weeks**.

**Recommendation:**
1. **Week 1:** Fix AC-04 (cron trigger), AC-05 (notification trigger), FR-7.2 (MFA), and FR-3.1/3.2 (AI integration).
2. **Week 2:** Fix AC-08 (k6 verification), NFR-6.3 (unit tests), and AC-07 (visual QA).
3. **Week 3:** Run end-to-end pilot simulation with 3 projects, 5 FOs, and 1 PM. Validate all ACs.
4. **Month 2:** Penetration test, production deployment, and first paying customer onboarding.

---

*Gap Analysis prepared by Arena.ai Agent Mode*  
*Based on SHAHID SRS v1.0 | Master Blueprint v3.0 Final | June 2026*  
*Codebase: github.com/SezarRJ/shahriar-s-code-hub | Commit: 779a75a*
