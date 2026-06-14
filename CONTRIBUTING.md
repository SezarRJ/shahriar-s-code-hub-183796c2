# Contributing to SHAHID — شاهد

Thank you for contributing to the SHAHID platform. This document outlines the standards, workflows, and review requirements for all contributors.

> **Target Audience**: Development Team (Part III of Master Blueprint v3.0 Final)
> **Document Status**: Final — Year 1 MVP Scope

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Development Workflow](#development-workflow)
3. [Branch Strategy](#branch-strategy)
4. [Commit Convention](#commit-convention)
5. [Pull Request Requirements](#pull-request-requirements)
6. [Testing Standards](#testing-standards)
7. [Security & Compliance](#security--compliance)
8. [RTL & Localization QA](#rtl--localization-qa)
9. [Database Migrations](#database-migrations)
10. [Environment & Secrets](#environment--secrets)
11. [Contact](#contact)

---

## Code of Conduct

- **Reality Before Interpretation**: Facts precede opinions. Evidence precedes conclusions.
- **Field Generates Truth**: The construction site is the single source of truth.
- **Human Accountability**: Humans remain accountable for all decisions; AI only assists.
- **Evidence Over Claims**: Documented evidence supersedes verbal or unverified claims.
- **Auditability By Design**: Every action, capture, and change is auditable.

---

## Development Workflow

```bash
# 1. Start from the correct branch
git checkout develop
git pull origin develop

# 2. Create a feature branch
git checkout -b feature/FR-1.2-gps-accuracy

# 3. Make changes, commit, push
git commit -m "feat(photos): add GPS accuracy indicator to capture overlay"
git push origin feature/FR-1.2-gps-accuracy

# 4. Open Pull Request against develop
#    → CODEOWNERS will auto-assign reviewers
#    → CI runs (lint, build, test, DB migration, integration)
#    → Manual QA for RTL / mobile layouts
#    → Security review if auth/data changes
#    → Approval required from relevant code owners

# 5. Merge only after all checks pass and approvals received
#    → Squash-merge or rebase-merge (no merge commits)
```

---

## Branch Strategy

| Branch | Purpose | Merge Rules |
|--------|---------|-------------|
| `main` | Production code | Only from `staging` via PR; requires 2 approvals + all CI green |
| `staging` | Pre-production integration | From `develop` via PR; requires 1 approval + integration test pass |
| `develop` | Active development | Feature branches merge here; requires CI green + 1 approval |
| `feature/*` | New features | Branch from `develop`; merge via PR |
| `fix/*` | Bug fixes | Branch from `develop` (or `hotfix/*` from `main` for critical) |
| `chore/*` | Maintenance, deps | Branch from `develop` |
| `release/*` | Release preparation | Branch from `develop`; merge to `staging` |

**Naming Convention**:
```
feature/FR-1.2-gps-accuracy
feature/NFR-2.1-tls-1.3-enforcement
fix/AC-06-rbac-escalation-vulnerability
chore/upgrade-supabase-js-v2.50
hotfix/critical-auth-bypass-2026-06-13
```

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) with the SHAHID scope vocabulary.

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Use When |
|------|----------|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `docs` | Documentation only |
| `chore` | Build, dependencies, CI, tooling |
| `security` | Security fix or hardening |
| `db` | Database migration or schema change |

### Scopes

| Scope | Component |
|-------|-----------|
| `auth` | Authentication / RBAC / Supabase Auth |
| `photos` | Photo capture, upload, storage, hash |
| `capture` | Capture points, routes, zones |
| `projects` | Project management, hierarchy |
| `reports` | Weekly PDF, schedule comparison |
| `ai` | AI classification, defect detection |
| `notifications` | Push, email, in-app alerts |
| `web` | React dashboard, RTL, UI |
| `mobile` | Flutter app, offline sync, GPS |
| `db` | PostgreSQL schema, RLS, triggers |
| `infra` | Docker, AWS, CI/CD, Terraform |
| `api` | API Gateway, endpoints, middleware |

### Examples

```
feat(photos): add SHA-256 verification endpoint
fix(auth): prevent privilege escalation in tenant context middleware
refactor(db): optimize RLS policy for capture_points on large projects
security(api): enforce rate limiting on evidence export endpoints
db(migrations): add OpenTimestamps column for blockchain anchoring (optional)
perf(mobile): batch upload 10 photos instead of sequential uploads
```

---

## Pull Request Requirements

### Mandatory Checks

Before requesting review, ensure:

- [ ] **Tests**: Unit test coverage ≥ 70% for modified business logic modules
- [ ] **Lint**: No errors (`npm run lint`, `flutter analyze`, `ruff check`)
- [ ] **Build**: Clean build (`npm run build`, `flutter build apk`)
- [ ] **Security**: OWASP Top 10 checked for any auth, RBAC, or data handling changes
- [ ] **RTL QA**: Arabic RTL layout verified for web/mobile UI changes (screenshots attached)
- [ ] **DB Migrations**: If schema changed, migration file is reversible and tested against local Supabase
- [ ] **Env Variables**: New environment variables documented in `.env.example` and README
- [ ] **SRS Traceability**: Requirement ID (`FR-XX`, `NFR-XX`, `AC-XX`) referenced in PR description

### Review Assignment

| Change Type | Required Reviewers |
|-------------|-------------------|
| API / Database | Backend Lead + DevOps Lead |
| Web Dashboard | Frontend Lead + Product Manager |
| Mobile App | Mobile Lead + QA Engineer |
| AI / ML | AI Team Lead + Backend Lead |
| Infrastructure / CI | DevOps Lead + Architect |
| Security-critical | Security Lead + Architect |
| Cross-cutting (architecture) | All Leads + Architect |

### Merge Rules

- **Develop**: 1 approval + all CI checks green
- **Staging**: 1 approval + integration test suite passed + security scan clean
- **Main**: 2 approvals + staging smoke test passed + product sign-off

---

## Testing Standards

### Unit Tests

- **Node.js**: Jest + `ts-jest`; coverage target 70% on business logic modules
- **Flutter**: `flutter_test`; widget tests for screens, unit tests for services/blocs
- **Python**: `pytest`; mock external APIs (Google Vision, Claude) for unit tests

### Integration Tests

- **AC-01 (Offline Resilience)**: Disable network for 24h, capture 100 photos, re-enable, verify zero data loss and correct hashes
- **AC-02 (Hash Verification)**: Recompute SHA-256 for 100 stored photos; 100% match required
- **AC-06 (RBAC Immutability)**: Attempt modification via API for every role → expect 403 Forbidden
- **AC-08 (Load Test)**: 50 concurrent FO sessions capturing simultaneously; P95 API response < 500ms

### E2E / Manual QA

- **AC-07 (RTL QA)**: Zero layout defects in Arabic on Android 14 + Chrome latest
- **AC-03 (CSV Import)**: Upload 50-point CSV; verify all imported with correct hierarchy
- **AC-09 (Evidence Export)**: Generate PDF; verify hash independently with `sha256sum`

---

## Security & Compliance

### OWASP Top 10 Checklist

For any PR touching auth, API, or data handling:

- [ ] **A01 Broken Access Control**: RLS policies enforced server-side; no client-side trust
- [ ] **A02 Cryptographic Failures**: TLS 1.3 in transit, AES-256 at rest, SHA-256 for photo integrity
- [ ] **A03 Injection**: Parameterized queries only; no raw string concatenation in SQL
- [ ] **A04 Insecure Design**: Immutability triggers active on `photos` table; no bypass possible
- [ ] **A05 Security Misconfiguration**: `.env` files never committed; secrets in GitHub Secrets only
- [ ] **A06 Vulnerable Components**: Dependency audit via `npm audit`, `pip audit`, `flutter pub audit`
- [ ] **A07 Auth Failures**: MFA for Tenant Admin + PM roles; session timeout 30 min (web) / 8h (mobile)
- [ ] **A08 Data Integrity Failures**: WORM S3 policy; SHA-256 hash verification on demand
- [ ] **A09 Logging Failures**: Structured JSON logs with correlation IDs; 90-day retention
- [ ] **A10 SSRF**: No server-side requests to user-supplied URLs; whitelist outbound API endpoints

### Penetration Testing

- **Before first paying customer**: External or internal red team penetration test
- **After major architecture changes**: Security regression test
- **Quarterly**: Dependency vulnerability scan + automated SAST (SonarQube / CodeQL)

---

## RTL & Localization QA

### Arabic (RTL) — Primary Language

All UI changes must be tested in Arabic RTL mode. **Zero defects acceptable at MVP acceptance.**

**Checklist**:
- [ ] Text direction is RTL (no mixed-direction rendering issues)
- [ ] No text overflow or truncation in buttons, labels, cards
- [ ] Icons that imply direction (arrows, back buttons) are mirrored correctly
- [ ] Calendar / date pickers show Arabic numerals and Hijri support where applicable
- [ ] PDF reports render Arabic text correctly (RTL-compatible PDF library)
- [ ] No layout shifts when toggling between Arabic and English

### English (LTR) — Secondary Language

- [ ] Language toggle works per user account without app restart
- [ ] All date/number formats are locale-aware (ISO 8601 stored internally)
- [ ] PDF reports generated in user's selected language

---

## Database Migrations

### Rules

1. **All migrations are forward-only in production**. No `ALTER TABLE ... DROP COLUMN` on live data without 30-day deprecation.
2. **Immutable tables** (`photos`, `audit_logs`) must never have `DELETE` or `UPDATE` migrations that bypass triggers.
3. **RLS policies** must be updated simultaneously with schema changes.
4. **Migration files** are named: `NNN_descriptive_name.sql` (e.g., `002_add_snag_due_date_index.sql`).
5. **Seed data** is only for local/dev environments; never for production.

### Testing Migrations

```bash
# Fresh database test
docker-compose up -d supabase-db
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres \
  -f database/supabase/migrations/001_initial_schema.sql

# Rollback test (if applicable — use transaction blocks in migration scripts)
```

---

## Environment & Secrets

### `.env` File Policy

- **NEVER** commit `.env` files, `.env.local`, or any file containing secrets.
- **ALWAYS** add new variables to `.env.example` with descriptive comments and dummy values.
- **Production secrets** are stored in:
  - GitHub Repository Secrets (for CI/CD)
  - AWS Secrets Manager / Parameter Store (for runtime)
  - Supabase Vault (for database credentials)

### Required Secrets for CI/CD

| Secret | Used By | Scope |
|--------|---------|-------|
| `SUPABASE_SERVICE_KEY` | API Gateway, CI | Local / Staging / Prod |
| `S3_ACCESS_KEY` | Storage Service | Staging / Prod |
| `S3_SECRET_KEY` | Storage Service | Staging / Prod |
| `FCM_SERVER_KEY` | Notification Service | Staging / Prod |
| `SMTP_PASS` | Notification Service | Staging / Prod |
| `ANTHROPIC_API_KEY` | AI Service | Staging / Prod |
| `GOOGLE_VISION_API_KEY` | AI Service | Staging / Prod |
| `SLACK_WEBHOOK_URL` | Deploy workflow | Prod |
| `CODECOV_TOKEN` | CI (coverage upload) | All |

---

## Contact

| Role | Contact | Responsibility |
|------|---------|--------------|
| Platform Architect | architects@shahid-platform.dev | Architecture decisions, cross-team alignment |
| Backend Lead | backend@shahid-platform.dev | API, database, services |
| Frontend Lead | frontend@shahid-platform.dev | Web dashboard, React, MUI, RTL |
| Mobile Lead | mobile@shahid-platform.dev | Flutter, offline-first, GPS, camera |
| AI Team Lead | ai@shahid-platform.dev | Classification, defect detection, model governance |
| DevOps Lead | devops@shahid-platform.dev | Infrastructure, CI/CD, security, compliance |
| Product Manager | product@shahid-platform.dev | SRS traceability, acceptance criteria, roadmap |
| Security Lead | security@shahid-platform.dev | Penetration testing, audit, vulnerability response |

---

<div align="center">

**SHAHID — شاهد** | SRS v1.0 | Master Blueprint v3.0 Final | June 2026

</div>
