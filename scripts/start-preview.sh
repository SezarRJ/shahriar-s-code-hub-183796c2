#!/bin/bash
# SHAHID Live Preview Startup Script
# Version: 1.0 | June 2026

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 SHAHID Live Preview Startup"
echo "================================"

# ──────────────────────────────────────────────
# 1. Check Docker
# ──────────────────────────────────────────────
echo ""
echo "🔍 Step 1: Checking Docker..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "   Install: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo ""
    echo "   Start Docker:"
    echo "   • macOS:     open -a Docker"
    echo "   • Linux:     sudo systemctl start docker"
    echo "   • Windows:   Start Docker Desktop from Start Menu"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"

# ──────────────────────────────────────────────
# 2. Check for port conflicts
# ──────────────────────────────────────────────
echo ""
echo "🔍 Step 2: Checking for port conflicts..."

PORTS=(3000 3001 3002 3003 3004 5001 5432 6379 9000 9001 8025 9999)
CONFLICTS=()

for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":$port "; then
        CONFLICTS+=("$port")
    fi
done

if [ ${#CONFLICTS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Port conflicts detected:${NC}"
    for port in "${CONFLICTS[@]}"; do
        echo "   • Port $port is already in use"
    done
    echo ""
    echo "   Options:"
    echo "   1. Stop the conflicting services"
    echo "   2. Edit docker-compose.yml to use different ports"
    echo ""
    read -p "   Stop conflicting processes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for port in "${CONFLICTS[@]}"; do
            PID=$(lsof -t -i:$port 2>/dev/null || echo "")
            if [ ! -z "$PID" ]; then
                kill -9 $PID 2>/dev/null && echo "   ✅ Killed process on port $port" || echo "   ⚠️  Could not kill process on port $port (may need sudo)"
            fi
        done
    fi
else
    echo -e "${GREEN}✅ All ports available${NC}"
fi

# ──────────────────────────────────────────────
# 3. Generate .env if missing
# ──────────────────────────────────────────────
echo ""
echo "🔍 Step 3: Checking environment..."

if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Generating...${NC}"
    bash scripts/setup-local-dev.sh --quick
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# ──────────────────────────────────────────────
# 4. Start Docker Compose
# ──────────────────────────────────────────────
echo ""
echo "🐳 Step 4: Starting Docker infrastructure..."

docker-compose down 2>/dev/null || true
sleep 2

docker-compose up -d --build

echo ""
echo "   ⏳ Waiting for services to start (30 seconds)..."
sleep 30

# ──────────────────────────────────────────────
# 5. Health Checks
# ──────────────────────────────────────────────
echo ""
echo "🏥 Step 5: Health checks..."

HEALTH_CHECKS=(
    "http://localhost:3001/health:API Gateway"
    "http://localhost:5001/health:AI Service"
    "http://localhost:3002/health:Report Service"
    "http://localhost:3003/health:Notification Service"
    "http://localhost:3004/health:Storage Service"
    "http://localhost:9001:MinIO Console"
    "http://localhost:8025:MailHog Web"
)

ALL_HEALTHY=true
for check in "${HEALTH_CHECKS[@]}"; do
    IFS=':' read -r url name <<< "$check"
    if curl -sf "$url" > /dev/null 2>&1 || curl -sfI "$url" > /dev/null 2>&1; then
        echo -e "   ${GREEN}✅${NC} $name ($url)"
    else
        echo -e "   ${RED}❌${NC} $name ($url) — NOT RESPONDING"
        ALL_HEALTHY=false
    fi
done

if [ "$ALL_HEALTHY" = false ]; then
    echo ""
    echo -e "${RED}Some services are not healthy. Checking logs...${NC}"
    docker-compose logs --tail=50
    exit 1
fi

# ──────────────────────────────────────────────
# 6. Seed Database
# ──────────────────────────────────────────────
echo ""
echo "🗄️  Step 6: Seeding database..."

for i in {1..30}; do
    if pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; then
        echo -e "   ${GREEN}✅${NC} PostgreSQL ready"
        break
    fi
    echo "   ⏳ Waiting for PostgreSQL... ($i/30)"
    sleep 2
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL failed to start${NC}"
        docker-compose logs supabase-db
        exit 1
    fi
done

PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d postgres \
    -f database/supabase/migrations/001_initial_schema.sql > /dev/null 2>&1

PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d postgres \
    -f database/supabase/migrations/002_mfa_and_tenant_assignment.sql > /dev/null 2>&1

PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d postgres \
    -f scripts/seed-users.sql > /dev/null 2>&1

echo -e "   ${GREEN}✅${NC} Database seeded with test users and demo project"

# ──────────────────────────────────────────────
# 7. Start Web Dashboard (if requested)
# ──────────────────────────────────────────────
echo ""
echo "🖥️  Step 7: Start Web Dashboard?"
read -p "   Start React web dashboard on http://localhost:3000? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd apps/web
    if [ ! -d node_modules ]; then
        echo "   📦 Installing web dependencies..."
        npm install
    fi
    echo "   🚀 Starting web dashboard..."
    npm run dev &
    WEB_PID=$!
    sleep 5
    echo -e "   ${GREEN}✅${NC} Web dashboard running at http://localhost:3000"
    echo "      PID: $WEB_PID (kill $WEB_PID to stop)"
    cd ../..
fi

# ──────────────────────────────────────────────
# 8. Summary
# ──────────────────────────────────────────────
echo ""
echo -e "${GREEN}🎉 SHAHID Live Preview is Ready!${NC}"
echo "===================================="
echo ""
echo "📋 Access Points:"
echo "   • API Gateway:    http://localhost:3001/api/v1"
echo "   • Web Dashboard:  http://localhost:3000"
echo "   • MinIO Console:  http://localhost:9001 (minioadmin/minioadmin123)"
echo "   • MailHog Web:  http://localhost:8025"
echo "   • PostgreSQL:     localhost:5432 (postgres/postgres)"
echo "   • Redis:          localhost:6379"
echo ""
echo "👤 Test Login Credentials:"
echo "   Email:    pm@shahid.dev"
echo "   Password: Password123!"
echo "   Role:     Project Manager"
echo ""
echo "🛠️  Useful Commands:"
echo "   View logs:          docker-compose logs -f"
echo "   Stop all:           docker-compose down"
echo "   Restart:            docker-compose restart"
echo "   Check DB:           PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c '\\dt'"
echo ""
