#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"
DB_HOST="localhost"; DB_PORT="5432"; DB_USER="postgres"; DB_PASS="postgres"; DB_NAME="postgres"

echo "🚀 SHAHID Local Development Setup"
echo "=================================="

generate_secret() { openssl rand -hex 32; }

echo "🔐 Step 1: Generating local credentials..."
if [ -f "$ENV_FILE" ]; then cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%s)"; fi

cat > "$ENV_FILE" <<EOF
# ============================================================
# SHAHID Local Development Environment — Auto-Generated
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# WARNING: These are DEVELOPMENT credentials only. Never commit to Git.
# ============================================================
NODE_ENV=development
LOG_LEVEL=debug
API_GATEWAY_PORT=3001
SUPABASE_URL=http://supabase-auth:9999
SUPABASE_SERVICE_KEY=$(generate_secret).$(generate_secret).$(generate_secret)
CORS_ORIGINS=http://localhost:3000,http://localhost:8080,http://localhost:19006
API_ENCRYPTION_KEY=$(generate_secret)
DATABASE_URL=postgres://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASS
POSTGRES_DB=$DB_NAME
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=shahid-photos
S3_REPORTS_BUCKET=shahid-reports
S3_REGION=us-east-1
REPORT_SERVICE_PORT=3002
NOTIFICATION_SERVICE_PORT=3003
FCM_SERVER_KEY=dev-fcm-key-$(generate_secret)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
AI_SERVICE_PORT=5001
GOOGLE_VISION_API_KEY=
ANTHROPIC_API_KEY=
STORAGE_SERVICE_PORT=3004
VITE_API_BASE_URL=http://localhost:3001/api/v1
OPENTIMESTAMPS_ENABLED=false
SLACK_WEBHOOK_URL=
EOF

echo "   ✅ .env file created"

echo "🐳 Step 2: Starting Docker infrastructure..."
cd "$PROJECT_ROOT"
if command -v docker-compose &> /dev/null; then docker-compose up -d --build; elif command -v docker &> /dev/null && docker compose version &> /dev/null; then docker compose up -d --build; else echo "❌ Docker Compose not found"; exit 1; fi
echo "   ⏳ Waiting for services (30s)..."; sleep 30

echo "🗄️  Step 3: Running database migrations..."
for i in {1..30}; do
  if pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then echo "   ✅ PostgreSQL ready"; break; fi
  echo "   ⏳ Waiting for PostgreSQL... ($i/30)"; sleep 2
  if [ $i -eq 30 ]; then echo "❌ PostgreSQL failed to start"; exit 1; fi
done

PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$PROJECT_ROOT/database/supabase/migrations/001_initial_schema.sql" > /dev/null 2>&1
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$PROJECT_ROOT/database/supabase/migrations/002_mfa_and_tenant_assignment.sql" > /dev/null 2>&1
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$PROJECT_ROOT/scripts/seed-users.sql" > /dev/null 2>&1

echo "   ✅ Migrations and seed data applied"

echo "👤 Step 4: Test users seeded:"
echo "      - sa@shahid.dev / Password123! (Super Admin)"
echo "      - ta@shahid.dev / Password123! (Tenant Admin)"
echo "      - pm@shahid.dev / Password123! (Project Manager)"
echo "      - ss@shahid.dev / Password123! (Site Supervisor)"
echo "      - fo@shahid.dev / Password123! (Field Operator)"
echo "      - ro@shahid.dev / Password123! (Read Only)"

echo "🏥 Step 5: Health checks..."
for endpoint in "http://localhost:3001/health:API Gateway" "http://localhost:5001/health:AI Service" "http://localhost:3002/health:Report Service" "http://localhost:3003/health:Notification Service" "http://localhost:3004/health:Storage Service" "http://localhost:9001:MinIO Console" "http://localhost:8025:MailHog Web"; do
  IFS=':' read -r url name <<< "$endpoint"
  if curl -sf "$url" > /dev/null 2>&1 || curl -sfI "$url" > /dev/null 2>&1; then echo "   ✅ $name is healthy ($url)"; else echo "   ⚠️  $name not responding ($url)"; fi
done

echo ""
echo "🎉 SHAHID Local Development Setup Complete!"
echo "=============================================="
echo "📋 Access Points:"
echo "   • API Gateway:    http://localhost:3001/api/v1"
echo "   • Web Dashboard:  cd apps/web && npm install && npm run dev"
echo "   • MinIO Console:  http://localhost:9001 (minioadmin / minioadmin123)"
echo "   • MailHog Web:  http://localhost:8025"
echo "   • PostgreSQL:     localhost:5432 (postgres / postgres)"
echo "   • Redis:          localhost:6379"
echo ""
echo "⚠️  IMPORTANT: .env is in .gitignore — NEVER commit it."
