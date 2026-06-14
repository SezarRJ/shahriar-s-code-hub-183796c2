# SHAHID Operational Runbook: Incident Response
## Overview
Standard operating procedure for responding to platform incidents.

## Severity Levels
| Level | Definition | Action |
|-------|------------|--------|
| **S1 (Critical)** | Platform total outage; data loss; security breach | Immediate alert $\rightarrow$ War room $\rightarrow$ Hourly updates |
| **S2 (High)** | Major feature failure (e.g., AI analysis down); slow performance | Alert $\rightarrow$ Investigation $\rightarrow$ 4h updates |
| **S3 (Medium)** | Minor bug; UX issues; infrequent failures | Ticket $\rightarrow$ Backlog $\rightarrow$ Next sprint |

## Response Workflow
1. **Detection**:
   - Monitor Grafana alerts or receive User Report.
2. **Triage**:
   - Assign severity (S1/S2/S3).
   - Identify affected services (e.g., `shahid-ai-service`).
3. **Containment**:
   - Scale services if overloaded.
   - Roll back last deployment if bug was introduced.
4. **Resolution**:
   - Apply hotfix.
   - Verify fix via `/health` and E2E tests.
5. **Post-Mortem**:
   - Document root cause.
   - Implement preventative measures.

## Escalation Matrix
- **Infrastructure Issues**: Platform Engineer.
- **AI/ML Issues**: ML Engineer.
- **Auth/Data Issues**: Backend Lead.
- **UI/UX Issues**: Frontend Lead.
