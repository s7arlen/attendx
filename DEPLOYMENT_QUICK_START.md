# Deployment Quick Start Guide

**For**: Team leads, DevOps engineers, deployment managers  
**Time Required**: 15-30 minutes (staging) + 10-15 minutes (production)  
**Prerequisites**: Git access, database credentials, API keys

---

## Overview

The facial recognition feature is production-ready. This guide walks through deploying to staging, testing, then production.

**Status**: ✅ Code ready | ✅ Tests passed | ✅ Documentation complete

---

## Phase 1: Staging Deployment (1-2 days before production)

### Step 1: Prepare Staging Environment

```bash
# 1. SSH into staging server
ssh user@staging.attendex.com

# 2. Navigate to project
cd /var/www/attendex

# 3. Backup database
mongodump --uri mongodb://user:pass@localhost:27017/attendx \
  --out ./backups/attendx_$(date +%Y%m%d_%H%M%S)

# 4. Pull latest code from main branch
git fetch origin main
git checkout main
git pull origin main
```

### Step 2: Install Dependencies

```bash
# Backend dependencies
cd backend
npm install
npm run build  # Verify TypeScript compilation

# Frontend dependencies
cd ../frontend
npm install
npm run build  # Create production build

cd ..
```

### Step 3: Configure Environment

```bash
# Copy .env.example to .env (staging)
cp backend/.env.example backend/.env.staging

# Edit .env.staging with staging values:
nano backend/.env.staging

# Key staging variables to set:
NODE_ENV=staging
MONGODB_URI=mongodb://staging-db:27017/attendx-staging
FACE_SIMILARITY_THRESHOLD=0.65
WEBAUTHN_RP_ID=staging.attendex.com

# Frontend environment (Vite uses .env.staging)
cp frontend/.env.local frontend/.env.staging
nano frontend/.env.staging

# Key staging variables:
VITE_API_URL=https://staging.attendex.com/api
VITE_ENV=staging
```

### Step 4: Deploy Backend

```bash
# Using PM2 (recommended)
cd backend

# Stop existing service
pm2 stop attendex-backend
pm2 delete attendex-backend

# Start new instance
pm2 start "npm run dev" --name attendex-backend --env staging

# Verify startup
pm2 logs attendex-backend | head -20

# Or using Docker
docker-compose down
docker-compose up -d --build
```

### Step 5: Deploy Frontend

```bash
cd frontend

# Build production bundle
npm run build

# Deploy to web server (nginx/Apache)
# Copy dist/ to web root
sudo cp -r dist/* /var/www/html/attendex/

# Or deploy to CDN
aws s3 sync dist/ s3://attendex-staging/
```

### Step 6: Verify Staging Deployment

```bash
# Check backend health
curl -s https://staging.attendex.com/api/health | jq .

# Check frontend loads
curl -s https://staging.attendex.com | grep -i "attendex"

# Check logs for errors
pm2 logs attendex-backend | grep -i error

# Monitor for 5 minutes
pm2 monit
```

### Step 7: Run Smoke Tests (Staging)

```powershell
# From your local machine, run smoke tests
cd c:\Users\LENSTAR\Downloads\MY-PROJECTS\ATTENDEX

# Get staging auth token
$token = "your-staging-test-token"

# Run functional tests
.\functional-test.ps1 `
  -AuthToken $token `
  -BaseUrl "https://staging.attendex.com/api"

# Expected: 8/8 tests PASS

# Run load test (light)
.\load-test.ps1 `
  -LoadLevel "normal" `
  -Environment "staging" `
  -BaseUrl "https://staging.attendex.com/api"

# Expected: Avg response < 300ms
```

### Step 8: Conduct UAT (User Acceptance Testing)

**Duration**: 1-2 days

**Checklist**:
- [ ] Teachers can create QR codes for sessions
- [ ] Students can scan QR and choose facial recognition
- [ ] Camera permission prompts work
- [ ] Face captures successfully (3 frames averaged)
- [ ] Verification succeeds for registered students
- [ ] Verification fails for unregistered students
- [ ] Attendance records marked correctly
- [ ] Duplicate prevention works (can't mark twice)
- [ ] Error messages are clear
- [ ] Mobile phones work (iOS & Android)
- [ ] No console errors (F12)
- [ ] API response times acceptable
- [ ] Database performance stable
- [ ] No memory leaks after 1 hour of use

**Collect Feedback**:
- User experience survey
- Performance observations
- Error messages encountered
- Suggestions for Phase 2

---

## Phase 2: Production Deployment

### Pre-Deployment Checklist (2-4 hours before)

- [ ] Database backup created
  ```bash
  mongodump --uri mongodb://user:pass@prod-db:27017/attendx \
    --out ./backups/attendx_predeployment_$(date +%Y%m%d_%H%M%S)
  ```

- [ ] Staging tests all pass ✅

- [ ] Team notified of deployment window

- [ ] Rollback procedure tested

- [ ] Monitoring dashboards configured

- [ ] Alert thresholds set

- [ ] On-call support assigned

- [ ] Communication channel open (Slack/Teams)

### Deployment Steps (Production)

```bash
# 1. SSH into production server
ssh user@prod.attendex.com

# 2. Navigate to project
cd /var/www/attendex

# 3. Create backup point
git tag backup-before-facial-recognition-$(date +%Y%m%d_%H%M%S)

# 4. Pull latest code
git fetch origin main
git checkout main
git pull origin main

# 5. Install/update dependencies
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
cd ..

# 6. Update environment (if needed)
# Edit backend/.env with production values
nano backend/.env

# 7. Deploy with PM2 (zero downtime)
pm2 reload attendex-backend --update-env

# 8. Clear frontend cache
sudo systemctl reload nginx  # or apache

# 9. Verify deployment
curl https://prod.attendex.com/api/health

# 10. Monitor logs
pm2 logs attendex-backend | head -50

# 11. Watch for 30 minutes
watch -n 5 'pm2 status'
```

### Post-Deployment Verification (First 24 hours)

#### Hour 1: Immediate Verification
```bash
# Check error rate
pm2 logs attendex-backend | grep -c ERROR

# Check response times
pm2 logs attendex-backend | grep -E "Duration|Response"

# Monitor CPU/Memory
pm2 monit

# Check database connectivity
curl https://prod.attendex.com/api/attendance/sessions

# Verify facial recognition endpoints
curl -X GET https://prod.attendex.com/api/attendance/sessions
```

#### Hours 2-24: Continuous Monitoring

| Metric | Target | Check Command |
|--------|--------|---------------|
| Error Rate | < 1% | `pm2 logs \| grep ERROR \| wc -l` |
| Response Time | < 500ms | Monitor in app |
| Uptime | > 99.5% | `pm2 status` |
| Database Queries | < 100ms | Check logs |
| Verification Success | > 95% | Check database records |
| CPU Usage | < 70% | `pm2 monit` |
| Memory Usage | < 80% | `pm2 monit` |

#### Collect Metrics
```bash
# Count successful verifications (first hour)
db.attendancerecords.count({
  "verificationMethod": "facial_recognition",
  "createdAt": { "$gte": ISODate("2025-01-26T00:00:00Z") },
  "isPresent": true
})

# Count failed verifications
db.attendancerecords.count({
  "verificationMethod": "facial_recognition",
  "createdAt": { "$gte": ISODate("2025-01-26T00:00:00Z") },
  "isPresent": false
})

# Calculate success rate
# success_rate = successful / (successful + failed) * 100
```

### Rollback Procedure (If Issues Occur)

**If you need to rollback immediately**:

```bash
# 1. Stop current service
pm2 stop attendex-backend

# 2. Revert to previous commit
git checkout HEAD~1  # or git checkout <commit-hash>

# 3. Rebuild
npm run build

# 4. Restart service
pm2 start attendex-backend

# 5. Verify
curl https://prod.attendex.com/api/health
pm2 logs attendex-backend | head -20
```

**Note**: Database schema changes are non-breaking (new fields optional). No migration rollback needed.

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Error Rate**: Alert if > 2% for 5 minutes
2. **Response Time**: Alert if avg > 1000ms
3. **Uptime**: Alert if < 99% (more than 14 minutes down per day)
4. **CPU Usage**: Alert if > 80%
5. **Memory Usage**: Alert if > 85%
6. **Database Latency**: Alert if > 500ms
7. **Verification Success Rate**: Alert if < 90%

### Alert Channels
- Slack: #attendex-prod-alerts
- Email: ops-team@attendex.com
- PagerDuty: Automatic escalation

### Daily Checks (First Week)

```bash
# Monday, Tuesday, Wednesday, Thursday, Friday
# 9 AM, 12 PM, 3 PM, 6 PM

# 1. Check error rate
pm2 logs attendex-backend | grep ERROR | tail -100

# 2. Check performance
pm2 logs attendex-backend | grep Duration | tail -20

# 3. Check database
db.stats()

# 4. Check user feedback
# Review Slack channel for issues

# 5. Generate report
# Document any issues/observations
```

---

## Troubleshooting Quick Reference

### Problem: "Face descriptor validation failed"
**Solution**: 
- Verify face-api.js is loaded from CDN
- Check REACT_APP_FACE_API_URL in frontend .env
- Clear browser cache (Ctrl+Shift+Del)

### Problem: "Verification endpoint returns 401"
**Solution**:
- Check JWT token is valid (not expired)
- Verify user has student role
- Check authentication middleware is active

### Problem: "High response times (> 1000ms)"
**Solution**:
- Check database performance (slow queries)
- Monitor CPU/Memory usage
- Verify network connectivity
- Check TensorFlow.js model loading time

### Problem: "Database performance degraded"
**Solution**:
```bash
# Analyze slow queries
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().pretty()

# Check indexes
db.attendancerecords.getIndexes()
db.users.getIndexes()

# Rebuild if needed
db.attendancerecords.reIndex()
```

### Problem: "Memory leak detected"
**Solution**:
- Check for unclosed streams: `pm2 logs | grep stream`
- Restart service gracefully: `pm2 gracefulReload attendex-backend`
- Monitor for 1 hour to verify leak is fixed

### Problem: "HTTPS certificate expiry warning"
**Solution**:
```bash
# Check certificate validity
openssl s_client -connect prod.attendex.com:443 | grep "not After"

# Renew if needed (Let's Encrypt)
certbot renew --dry-run
certbot renew
```

---

## Rollback Decision Tree

```
Is facial recognition working?
├─ YES → ✅ Monitor and celebrate
└─ NO → 
    ├─ Error Rate > 10%?
    │  ├─ YES → 🔴 ROLLBACK immediately
    │  └─ NO → Continue to next check
    ├─ Verification Success Rate < 80%?
    │  ├─ YES → 🟡 Assess (may be user issue)
    │  └─ NO → Continue to next check
    ├─ Response Time > 2000ms?
    │  ├─ YES → 🟡 Investigate (don't rollback yet)
    │  └─ NO → Continue
    ├─ Security incidents reported?
    │  ├─ YES → 🔴 ROLLBACK immediately
    │  └─ NO → Proceed to production
    └─ All checks OK?
       └─ YES → ✅ Feature stable (Phase 2 planning)
```

---

## Success Metrics (1 Week Post-Deployment)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| System Uptime | > 99.5% | - | - |
| Error Rate | < 1% | - | - |
| Verification Success Rate | > 95% | - | - |
| Avg Response Time | < 500ms | - | - |
| Student Adoption | > 50% | - | - |
| Zero Security Issues | Yes | - | - |

---

## Post-Deployment Tasks (Week 2)

- [ ] Analyze metrics and performance
- [ ] Collect student feedback
- [ ] Address any issues found
- [ ] Plan Phase 2 features (liveness detection, etc.)
- [ ] Schedule retrospective meeting
- [ ] Document lessons learned

---

## Contacts & Escalation

| Role | Name | Contact | On-Call |
|------|------|---------|---------|
| DevOps Lead | - | - | 24/7 |
| Backend Lead | - | - | Business hours |
| Frontend Lead | - | - | Business hours |
| Security Team | - | - | As needed |
| Database Admin | - | - | As needed |

---

## Additional Resources

- **Full Validation Report**: FINAL_VALIDATION_REPORT.md
- **Deployment Checklist**: DEPLOYMENT_READINESS_FINAL.md
- **Sign-Off Document**: PRODUCTION_VALIDATION_CHECKLIST.md
- **Test Procedures**: FACIAL_RECOGNITION_TESTING.md
- **Implementation Details**: FACIAL_RECOGNITION_IMPLEMENTATION.md

---

**Status**: ✅ Ready for deployment

Need help? Check the documentation or contact the team on Slack.

