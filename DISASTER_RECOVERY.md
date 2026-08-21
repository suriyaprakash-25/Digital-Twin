# DrivePortz Disaster Recovery & Backup Readiness Playbook

## 1. Objectives & Metrics

| Metric | Target | Description |
|---|---|---|
| **RPO (Recovery Point Objective)** | **$\le$ 15 minutes** | Maximum allowable data loss in case of fatal infrastructure disaster. |
| **RTO (Recovery Time Objective)** | **$\le$ 30 minutes** | Maximum allowable time to restore full platform financial operations. |

---

## 2. Backup Strategy & Automation

### Automated MongoDB Atlas Snapshots:
- Continuous point-in-time recovery (PITR) enabled.
- Daily automated cluster snapshots retained for 30 days.
- Weekly cold backups archived in encrypted S3/GCS buckets with 365-day retention for regulatory compliance.

### Manual CLI Backup (Before Major Migrations):
```bash
mongodump --uri="mongodb+srv://<user>:<password>@cluster.mongodb.net/digital_twin" --gzip --archive=driveportz_backup_$(date +%F_%T).gz
```

---

## 3. Database Restore Procedure

### Step 1: Isolate & Protect Active Cluster
Set platform into maintenance mode to block incoming financial mutations:
```bash
# Set maintenance environment flag in backend
SETTLEMENT_MODE=MOCK_TEST_MODE
```

### Step 2: Restore from Archive
```bash
mongorestore --uri="mongodb+srv://<user>:<password>@cluster.mongodb.net/digital_twin" --drop --gzip --archive=driveportz_backup_<TIMESTAMP>.gz
```

### Step 3: Run Financial Integrity & Discrepancy Verification
Immediately execute the read-only integrity scanner to verify relational consistency across all financial collections:
```bash
curl -X POST https://driveportz.onrender.com/api/admin/financial-integrity/run \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

### Step 4: Rebuild & Verify Database Indexes
```bash
# Restart backend or trigger index initialization
node -e "const { loadConfig } = require('./src/config'); const { connectToMongo } = require('./src/db'); const { ensurePaymentIndexes } = require('./src/models/Payment'); (async () => { await connectToMongo(loadConfig()); await ensurePaymentIndexes(); process.exit(0); })();"
```

---

## 4. Post-Restore Financial Reconciliation

After database restoration:
1. Compare Razorpay gateway settlement reports with MongoDB `payments` and `garage_earnings`.
2. Inspect `financial_integrity_issues` collection for any orphaned payments or lock discrepancies.
3. Review `financial_audit_logs` to ensure append-only audit trail continuity.
4. Verify `tax_configurations` and ensure no historical tax snapshots were modified.

---

## 5. Incident Escalation Contacts

- **Lead Fintech Architect**: Suriya Prakash
- **Platform Infrastructure**: DevOps / Site Reliability Team
- **Gateway Support**: Razorpay Technical Account Manager
