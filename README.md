# SHAHID — شاهد

**The Project Manager's Digital Eye** | العين الرقمية لمدير المشروع

[![SHAHID CI](https://github.com/shahid-platform/shahid/actions/workflows/ci.yml/badge.svg)](https://github.com/shahid-platform/shahid/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)

> **Reality Before Interpretation. Facts precede opinions. Evidence precedes conclusions.**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Monorepo Structure](#monorepo-structure)
4. [Quick Start (Local Development)](#quick-start-local-development)
5. [Database & Migrations](#database--migrations)
6. [Service Details](#service-details)
7. [Mobile App (Flutter)](#mobile-app-flutter)
8. [Web Dashboard (React)](#web-dashboard-react)
9. [AI Service (Python)](#ai-service-python)
10. [Testing & Acceptance](#testing--acceptance)
11. [Deployment](#deployment)
12. [Contributing](#contributing)
13. [License](#license)

---

## Overview

SHAHID is a multi-platform construction site documentation and intelligence system targeting **Tier 1 (Vision) — Project Managers** as the Year 1 customer segment.

### Core Capabilities (Year 1 MVP)

| Feature | Description |
|---------|-------------|
| 📸 Photo Capture | GPS-tagged, NTP-synced, SHA-256 hashed photos |
| 🗺️ Zone Hierarchy | Project → Floor → Room → Capture Point |
| 📅 Schedule Comparison | Detect delays from baseline schedule |
| 📊 Weekly Reports | Auto-generated PDF reports every Monday |
| 🔒 Immutability | WORM storage; no tampering with metadata |
| 🧠 AI Assist | Stage classification & defect flagging (pre-trained models) |
| 🌐 Arabic RTL | Full Arabic UI support (primary language) |
| 📵 Offline First | 7-day local queue with auto-sync |

---

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Flutter App    │────▶│  AWS API     │────▶│  Supabase Auth  │
│  (Android/iOS)  │     │  Gateway     │     │  + PostgreSQL   │
└─────────────────┘     └──────────────┘     └─────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Storage     │      │  Report      │      │  Notification│
│  Service     │      │  Service     │      │  Service     │
│  (S3/MinIO)  │      │  (Node.js)   │      │  (FCM/Email) │
└──────────────┘      └──────────────┘      └──────────────┘
        │
        ▼
┌──────────────┐
│  AI Service  │
│  (Python)    │
│  Vision/Claude│
└──────────────┘

Data Layer: PostgreSQL 15 (Supabase) + AWS S3 (WORM) + Redis 7
```

---

## Monorepo Structure

```
shahid-platform/
├── apps/
│   ├── mobile/              # Flutter app (offline-first, GPS, SHA-256)
│   └── web/                 # React + TypeScript dashboard (RTL Arabic)
├── services/
│   ├── api-gateway/         # Express.js + Supabase Auth + RLS middleware
│   ├── capture-service/     # (merged into gateway) Photo upload logic
│   ├── storage-service/     # S3/MinIO upload, download, verify
│   ├── report-service/      # Weekly PDF generation + schedule comparison
│   ├── notification-service/ # FCM push + email + in-app
│   └── ai-service/         # Python 3.11 — Vision API / Claude classification
├── database/
│   └── supabase/
│       └── migrations/
│           └── 001_initial_schema.sql   # Full RLS + immutability triggers
├── docker-compose.yml       # Local dev stack (Supabase, Redis, MinIO, MailHog)
├── .github/
│   └── workflows/
│       ├── ci.yml           # Monorepo CI with path filters
│       └── deploy.yml       # Staging + Production deployment
└── README.md
```

---

## Quick Start (Local Development)

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local dev outside Docker)
- Python 3.11+ (for AI service local dev)
- Flutter 3.22+ (for mobile dev)

### 1. Clone & Start Infrastructure

```bash
git clone https://github.com/shahid-platform/shahid.git
cd shahid-platform

# Start everything (PostgreSQL, Supabase Auth, Redis, MinIO, MailHog, all services)
docker-compose up -d --build

# Wait 30 seconds for services to boot
sleep 30
```

### 2. Verify Health

```bash
curl http://localhost:3001/health   # API Gateway
curl http://localhost:5001/health   # AI Service
curl http://localhost:3002/health   # Report Service
curl http://localhost:3003/health   # Notification Service
curl http://localhost:3004/health   # Storage Service
```

### 3. Access Local Tools

| Service | URL |
|---------|-----|
| MinIO Console | http://localhost:9001 (minioadmin / minioadmin123) |
| MailHog Web | http://localhost:8025 |
| Web Dashboard | http://localhost:3000 (after `cd apps/web && npm run dev`) |

### 4. Run Database Migrations

Migrations auto-run on PostgreSQL init via Docker. If you need to re-run manually:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres \
  -f database/supabase/migrations/001_initial_schema.sql
```

### 5. Start Web Dashboard (Local Dev)

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

### 6. Start Mobile App (Local Dev)

```bash
cd apps/mobile
flutter pub get
flutter run
```

---

## Database & Migrations

### Key Schema Highlights

| Table | Purpose | Constraints |
|-------|---------|-------------|
| `tenants` | Multi-tenancy isolation | RLS enforced |
| `users` | RBAC (6 roles) | `tenant_id + email` unique |
| `projects` | Construction project | GeoJSON boundary support |
| `zones` | Hierarchical grouping | Self-referential parent |
| `capture_points` | Predefined photo locations | Active flag + frequency |
| `photos` | **Immutable core record** | `captured_at`, `GPS`, `hash` are protected by trigger |
| `ai_results` | Mutable AI analysis | Separate from `photos` |
| `audit_logs` | Full compliance trail | Append-only, no delete |

### Immutability Guarantee

```sql
-- Photos table: captured_at, gps_lat, gps_lng, hash_sha256 CANNOT be modified
-- Even Super Admin gets 403 equivalent (DB-level exception)
```

### Row-Level Security (RLS)

All tenant-scoped tables have RLS policies. PostgreSQL session variables `app.current_tenant_id`, `app.current_user_role`, and `app.current_user_id` must be set by the application layer before queries.

---

## Service Details

### API Gateway (`services/api-gateway`)

- **Port**: `3001`
- **Stack**: Express.js + TypeScript + Zod validation + Supabase Auth
- **Key Features**:
  - JWT verification via Supabase
  - Tenant context injection for RLS
  - Correlation ID tracing
  - Rate limiting (100 req/min per user)
  - Routes: `/api/v1/auth`, `/api/v1/projects`, `/api/v1/photos`, `/api/v1/evidence`, etc.

### Storage Service (`services/storage-service`)

- **Port**: `3004`
- **Stack**: Node.js + AWS SDK v3 for S3
- **Key Features**:
  - SHA-256 hash stored as S3 metadata on upload
  - `/verify/:key` endpoint recomputes hash for integrity checks
  - MinIO-compatible for local development

### Report Service (`services/report-service`)

- **Port**: `3002`
- **Stack**: Node.js + Puppeteer (PDF) + Redis queue
- **Key Features**:
  - Weekly auto-generation (Monday 08:00 local time)
  - Schedule comparison: calculates `days_behind` per capture point
  - `/schedule-status/:project_id` for real-time dashboard data

### Notification Service (`services/notification-service`)

- **Port**: `3003`
- **Stack**: Node.js + Nodemailer + Redis queue
- **Key Features**:
  - Email (SMTP / MailHog local)
  - FCM push notification queue (production)
  - In-app notification persistence (90 days)

### AI Service (`services/ai-service`)

- **Port**: `5001`
- **Stack**: Python 3.11 + FastAPI + Pillow
- **Key Features**:
  - `/analyze` — single photo classification (simulated for MVP; delegates to Google Vision / Claude in production)
  - `/batch-analyze` — queue all unprocessed photos via Redis
  - Background worker continuously processes `ai:queue`

---

## Mobile App (Flutter)

### Offline-First Architecture

```
Camera → EXIF/GPS → SHA-256 Hash → SQLite (photos_queue) → Background Sync → API Gateway
                                              │
                                              ▼
                                       7-day retention
                                       max 500 photos
```

### Key Features

- **NTP Sync**: `ntp` package ensures timestamps are not device-clock dependent
- **GPS Accuracy**: `geolocator` with `LocationAccuracy.best` (target ±5m)
- **SHA-256**: Computed on raw `Uint8List` bytes immediately after capture
- **Background Upload**: `workmanager` + `connectivity_plus` for auto-sync when Wi-Fi/4G available
- **RTL Arabic**: `Directionality` widget forces RTL; `Cairo` font
- **State Management**: `flutter_bloc` + `RepositoryProvider`

### Directory Structure

```
apps/mobile/lib/
├── main.dart
├── models/
│   └── capture_model.dart
├── services/
│   ├── auth_service.dart
│   ├── capture_service.dart
│   ├── sync_service.dart
│   └── database_service.dart
├── blocs/
│   ├── auth/
│   ├── capture/
│   └── sync/
├── screens/
│   ├── login_screen.dart
│   └── home_screen.dart
└── l10n/
    ├── app_ar.arb
    └── app_en.arb
```

---

## Web Dashboard (React)

### RTL-First Design

- `index.html` starts with `lang="ar" dir="rtl"`
- MUI `ThemeProvider` with `direction: 'rtl'`
- `Cairo` font from Google Fonts
- Arabic is the default; English toggle available via `i18next`

### Key Pages

| Page | Route | Features |
|------|-------|----------|
| Login | `/login` | Supabase Auth JWT, password validation |
| Dashboard | `/` | KPI cards, projects list, reports, notifications |
| Projects | `/projects` | CRUD, 3-level zone wizard, CSV import placeholder |
| Reports | `/reports` | Trigger on-demand, download PDF, view history |
| Evidence | `/evidence` | Export package, SHA-256 verify, display metadata |
| Users | `/users` | RBAC user management |
| Settings | `/settings` | Language, thresholds, MFA |

### Stack

- React 18 + Vite + TypeScript
- MUI v5 + DataGrid + DatePickers
- React Query (server state) + Zustand (client state)
- React Router v6
- Recharts (for future analytics)

---

## AI Service (Python)

### Year 1 Constraint

> No custom model training. Use pre-trained APIs only: Google Vision API, Claude (Anthropic).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/analyze` | Classify stage + flag defects for one photo |
| POST | `/batch-analyze` | Queue all unprocessed photos |
| GET | `/results/{photo_id}` | Retrieve stored AI result |
| GET | `/health` | Service health check |

### Background Worker

```python
async def ai_worker():
    while True:
        job = await redis.brpop("ai:queue", timeout=30)
        await analyze_photo(job)
```

---

## Testing & Acceptance

### MVP Acceptance Criteria (AC-01 to AC-10)

See [SRS v1.0 Section 6](docs/SRS-v1.0.md). All 10 criteria must pass binary before pilot launch.

| ID | Criterion | Test Method |
|----|-----------|-------------|
| AC-01 | 24h offline, zero data loss | Integration test with network disable |
| AC-02 | Hash + GPS + timestamp verification | Recompute SHA-256 for 100 test photos |
| AC-03 | 3-level hierarchy + 50 CSV import | Manual walkthrough + automated CSV test |
| AC-04 | Weekly auto-report PDF | Scheduled trigger + PDF parser validation |
| AC-05 | Overdue point + push notification | 10-minute frequency, verify within 15 min |
| AC-06 | No role can edit immutable fields | API modification attempts for all roles → 403 |
| AC-07 | Zero RTL defects | Manual QA on Android + Chrome in Arabic |
| AC-08 | 50 concurrent FO sessions | Load test with k6 (P95 < 500ms) |
| AC-09 | Evidence export + third-party hash verify | `sha256sum` on embedded PDF photo |
| AC-10 | RBAC role matrix | All role/action combinations tested |

### Running Tests Locally

```bash
# API Gateway
cd services/api-gateway
npm test

# AI Service
cd services/ai-service
pytest

# Web Dashboard
cd apps/web
npm run test

# Flutter (unit tests only; integration requires device/emulator)
cd apps/mobile
flutter test
```

---

## Deployment

### Environments

| Environment | Branch | Trigger |
|-------------|--------|---------|
| Local | `any` | `docker-compose up` |
| Staging | `staging` | Auto-deploy on push |
| Production | `main` | Auto-deploy after staging passes |

### Infrastructure (Production)

- **Compute**: AWS ECS Fargate (Node.js services) + AWS Lambda (AI batch)
- **Database**: Supabase PostgreSQL (managed, with RLS)
- **Auth**: Supabase Auth (JWT, MFA via TOTP)
- **Storage**: AWS S3 with WORM (Object Lock) + versioning
- **Cache**: AWS ElastiCache (Redis)
- **CDN**: CloudFront (web dashboard)
- **Push**: Firebase Cloud Messaging (FCM)
- **Email**: AWS SES

### CI/CD Pipeline

```
Push to branch
    │
    ▼
┌──────────────┐
│ GitHub Actions│
│   CI (ci.yml) │
│ - Lint / Build│
│ - Unit Tests   │
│ - DB Migration │
│ - Docker Build │
│ - Integration │
└──────────────┘
    │
    ▼
Merge to staging
    │
    ▼
┌──────────────┐
│  Deploy to   │
│   Staging    │
│   (ECS)      │
└──────────────┘
    │
    ▼
Smoke tests pass
    │
    ▼
Merge to main
    │
    ▼
┌──────────────┐
│  Deploy to   │
│  Production  │
│  (ECS + S3)  │
└──────────────┘
```

---

## Contributing

### Branch Naming

```
feature/FR-1.2-gps-accuracy
fix/AC-06-rbac-escalation
chore/dependency-updates
```

### Commit Convention

```
feat(photos): add SHA-256 hash verification endpoint
fix(auth): prevent privilege escalation in tenant context
refactor(db): optimize RLS policy for capture_points
```

### Code Review Requirements

- **API changes**: Require test coverage ≥ 70%
- **DB migrations**: Require schema review + rollback plan
- **UI changes**: Require RTL QA screenshot for Arabic
- **Security**: Require OWASP Top 10 check for auth/data changes

---

## License

Proprietary & Confidential — SHAHID Platform. Unauthorized distribution, modification, or use outside the licensed organization is strictly prohibited.

---

<div align="center">

**SHAHID — شاهد**

*The Project Manager's Digital Eye* | العين الرقمية لمدير المشروع

SRS v1.0 | Master Blueprint v3.0 Final | June 2026

</div>
