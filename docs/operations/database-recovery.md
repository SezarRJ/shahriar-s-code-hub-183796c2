# SHAHID Operational Runbook: Database Recovery
## Overview
Procedure for recovering the PostgreSQL database from backups in case of critical data loss or corruption.

## Backup Strategy
- **Provider**: Supabase Managed Backups.
- **Frequency**: Daily logical backups + Point-in-Time Recovery (PITR) via WAL archiving.
- **Storage**: Backups are stored in AWS S3 with Object Lock (WORM).

## Recovery Steps
1. **Identify Target Restore Point**:
   - Determine the exact timestamp before the data corruption occurred.
2. **Initiate Restore**:
   - Navigate to Supabase Dashboard $\rightarrow$ Database $\rightarrow$ Backups.
   - Select "Point-in-Time Recovery".
   - Enter the target timestamp.
3. **Verify Data Integrity**:
   - Restore to a **temporary isolated database** first.
   - Run verification queries to ensure data is correct.
4. **Switch Traffic**:
   - Once verified, promote the restored database to production.
   - Update `DATABASE_URL` in Render Environment Groups if the host changes.
5. **Post-Restore Validation**:
   - Verify all services can connect.
   - Run a sample report generation to ensure relational integrity.

## RTO/RPO Targets
- **RPO (Recovery Point Objective)**: $\le 1$ hour.
- **RTO (Recovery Time Objective)**: $\le 4$ hours.
