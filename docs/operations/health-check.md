# SHAHID Operational Runbook: Health Monitoring
## Overview
This document describes how to monitor and verify the health of the SHAHID platform services.

## Health Check Endpoints
Each service exposes a `/health` endpoint.

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| API Gateway | `/health` | `{ "status": "ok", "service": "shahid-api-gateway" }` |
| AI Service | `/health` | `{ "status": "ok", "service": "ai-service" }` |
| Storage Service | `/health` | `{ "status": "ok", "service": "storage-service" }` |
| Notification Service | `/health` | `{ "status": "ok", "service": "notification-service" }` |
| Report Service | `/health` | `{ "status": "ok", "service": "report-service" }` |

## Verification Procedure
1. **Gateway Check**: Visit `https://shahid-api-gateway.onrender.com/health`.
2. **Service Mesh Check**: The API Gateway aggregates health checks. Use the internal dashboard or health logs to ensure all downstream services are reachable.
3. **Log Monitoring**: Check Render logs for `ERROR` or `CRITICAL` levels.

## Troubleshooting
- **503 Service Unavailable**: Service is likely crashing or restarting. Check logs for `OOMKill` or `Unhandled Promise Rejection`.
- **401 Unauthorized**: Internal service token mismatch. Verify `INTERNAL_SERVICE_TOKEN` across all services.
- **504 Gateway Timeout**: Downstream service is not responding. Check network connectivity between services.
