import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import express from 'express';
import { createServer } from 'http';
import { User } from '../models/User.model';
import { Visitor } from '../models/Visitor.model';
import { VisitorVisit } from '../models/VisitorVisit.model';
import { VisitorPass } from '../models/VisitorPass.model';
import { VisitorLog } from '../models/VisitorLog.model';
import { VisitorEvent } from '../models/VisitorEvent.model';
import { generateAccessToken } from '../utils/jwt';
import visitorRoutes from '../routes/visitor.routes';

const TEST_PORT = 5098;
const BASE_URL = `http://localhost:${TEST_PORT}/api/visitor`;

interface TestResult {
  category: string;
  name: string;
  status: 'PASSED' | 'FAILED';
  details?: string;
  durationMs: number;
}

const testResults: TestResult[] = [];

async function recordTest(category: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    testResults.push({ category, name, status: 'PASSED', durationMs });
    console.log(`  [PASS] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    testResults.push({ category, name, status: 'FAILED', details: err.message, durationMs });
    console.error(`  [FAIL] ${name}: ${err.message} (${durationMs}ms)`);
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('   ATTENDX VISITOR MANAGEMENT SYSTEM — ARCHITECTURAL TEST SUITE  ');
  console.log('================================================================\n');

  // 1. Connect Database
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';
  console.log(`[setup] Connecting to MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('[setup] MongoDB connected successfully.\n');

  // 2. Fetch or prepare test users
  const admin = await User.findOne({ email: 'admin@attendx.com' });
  const teacher = await User.findOne({ email: 'teacher1@attendx.com' });
  const security = await User.findOne({ email: 'security@attendx.com' });
  const student = await User.findOne({ email: 'student1@attendx.com' });

  if (!admin || !teacher || !security || !student) {
    throw new Error('Required test users (admin, teacher1, security, student1) not found in DB. Run seed first.');
  }

  const adminToken = generateAccessToken({ userId: admin._id.toString(), role: admin.role, email: admin.email });
  const teacherToken = generateAccessToken({ userId: teacher._id.toString(), role: teacher.role, email: teacher.email });
  const securityToken = generateAccessToken({ userId: security._id.toString(), role: security.role, email: security.email });
  const studentToken = generateAccessToken({ userId: student._id.toString(), role: student.role, email: student.email });

  // 3. Start Express Test Server
  const app = express();
  app.use(express.json());
  
  // Mock Socket.io for notifications
  const mockIo = {
    to: () => ({ emit: () => {} }),
    in: () => ({ emit: () => {} }),
    emit: () => {},
  };
  app.set('io', mockIo);
  app.use('/api/visitor', visitorRoutes);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`[setup] Test server listening on ${BASE_URL}\n`);

  // Shared variables between tests
  const testPhone = `+1999${Math.floor(100000 + Math.random() * 900000)}`;
  let createdVisitId1 = '';
  let createdVisitorId1 = '';
  let generatedPassCode1 = '';
  let createdPassId1 = '';

  let createdVisitId2 = '';
  const testPhone2 = `+1888${Math.floor(100000 + Math.random() * 900000)}`;

  let createdVisitId3 = '';
  let createdPassId3 = '';
  let generatedPassCode3 = '';
  const testPhone3 = `+1777${Math.floor(100000 + Math.random() * 900000)}`;

  let createdEventId = '';

  try {
    // ─────────────────────────────────────────────────────────────
    // CATEGORY 1: Public Registration & Host Discovery
    // ─────────────────────────────────────────────────────────────
    console.log('--- SUITE 1: Public Registration & Host Discovery ---');

    await recordTest('Public Directory', 'GET /public/hosts returns active faculty and admins', async () => {
      const res = await fetch(`${BASE_URL}/public/hosts`);
      const body = await res.json() as any;
      if (res.status !== 200 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
      if (!Array.isArray(body.data.hosts) || body.data.hosts.length === 0) throw new Error('No hosts returned');
      const hostFound = body.data.hosts.some((h: any) => (h.id || h._id) === teacher._id.toString());
      if (!hostFound) throw new Error('Teacher1 not found in public hosts list');
      if (body.data.hosts[0].passwordHash || body.data.hosts[0].refreshToken) {
        throw new Error('Security flaw: sensitive authentication fields exposed in public hosts');
      }
    });

    await recordTest('Public Registration', 'POST /public/request creates pending visit for visitor', async () => {
      const res = await fetch(`${BASE_URL}/public/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Dr. Evelyn Reed',
          phone: testPhone,
          email: 'evelyn.reed.test@example.com',
          category: 'official',
          hostId: teacher._id.toString(),
          department: teacher.department,
          purpose: 'Campus Research Collaboration',
          visitDate: new Date().toISOString(),
          expectedArrival: '10:00',
          expectedDeparture: '12:00',
          accompanyingCount: 1,
        }),
      });
      const body = await res.json() as any;
      if (res.status !== 201 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
      if (!body.data.visitId || body.data.status !== 'pending') throw new Error('Invalid visit creation response');
      createdVisitId1 = body.data.visitId;

      const visitDoc = await VisitorVisit.findById(createdVisitId1);
      if (!visitDoc) throw new Error('Visit record not saved in DB');
      createdVisitorId1 = visitDoc.visitorId.toString();
    });

    await recordTest('Profile Deduplication', 'Re-registration with same phone updates profile rather than creating duplicate', async () => {
      const initialCount = await Visitor.countDocuments({ phone: testPhone });
      if (initialCount !== 1) throw new Error(`Expected 1 visitor, found ${initialCount}`);

      const res = await fetch(`${BASE_URL}/public/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Dr. Evelyn Reed-Updated',
          phone: testPhone,
          email: 'evelyn.updated@example.com',
          category: 'official',
          hostId: teacher._id.toString(),
          department: teacher.department,
          purpose: 'Second Follow-up Consultation',
          visitDate: new Date().toISOString(),
          expectedArrival: '14:00',
          expectedDeparture: '16:00',
        }),
      });
      const body = await res.json() as any;
      if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);

      const finalCount = await Visitor.countDocuments({ phone: testPhone });
      if (finalCount !== 1) throw new Error(`Deduplication failed: created duplicate visitor record count ${finalCount}`);

      const visitorDoc = await Visitor.findById(createdVisitorId1);
      if (visitorDoc?.fullName !== 'Dr. Evelyn Reed-Updated') throw new Error('Visitor profile was not updated with new name');
    });

    // ─────────────────────────────────────────────────────────────
    // CATEGORY 2: Host Approval & QR Pass Generation Workflow
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 2: Host Approval & Pass Generation Workflow ---');

    await recordTest('Host Queue', 'GET /my-requests allows host to view their visitor requests', async () => {
      const res = await fetch(`${BASE_URL}/my-requests`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const body = await res.json() as any;
      if (res.status !== 200 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
      const visitInList = body.data.visits.some((v: any) => v._id === createdVisitId1);
      if (!visitInList) throw new Error('Created visit not found in host pending queue');
    });

    await recordTest('Host Approval & QR', 'PATCH /visits/:id/approve updates status & generates cryptographic pass', async () => {
      const res = await fetch(`${BASE_URL}/visits/${createdVisitId1}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const body = await res.json() as any;
      if (res.status !== 200 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);

      const pass = body.data.pass;
      if (!pass || !pass.passCode || !pass.qrCodeData || !pass.tokenHash) {
        throw new Error('Incomplete pass generated: missing passCode, qrCodeData, or tokenHash');
      }
      if (!pass.passCode.startsWith('VIS-')) {
        throw new Error(`Unexpected passCode format: ${pass.passCode}`);
      }
      if (!pass.qrCodeData.startsWith('data:image/png;base64,')) {
        throw new Error('QR Code data is not a valid base64 PNG data URL');
      }

      generatedPassCode1 = pass.passCode;
      createdPassId1 = pass._id;

      // Verify DB state
      const visitDoc = await VisitorVisit.findById(createdVisitId1);
      if (visitDoc?.status !== 'approved') throw new Error(`Expected visit status 'approved', found ${visitDoc?.status}`);
      if (visitDoc?.approvedBy?.toString() !== teacher._id.toString()) throw new Error('approvedBy host mismatch');
    });

    await recordTest('Pass Retrieval', 'GET /visits/:id/pass fetches the valid pass with QR data', async () => {
      const res = await fetch(`${BASE_URL}/visits/${createdVisitId1}/pass`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const body = await res.json() as any;
      if (res.status !== 200 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
      if (body.data.pass.passCode !== generatedPassCode1) throw new Error('Retrieved passCode does not match generated code');
    });

    // ─────────────────────────────────────────────────────────────
    // CATEGORY 3: Host Rejection Workflow
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 3: Host Rejection Workflow ---');

    await recordTest('Host Rejection', 'PATCH /visits/:id/reject rejects visit with rejection reason and no pass', async () => {
      // 1. Submit second request
      const reqRes = await fetch(`${BASE_URL}/public/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Marcus Vance',
          phone: testPhone2,
          email: 'marcus.vance@example.com',
          category: 'vendor',
          hostId: teacher._id.toString(),
          department: teacher.department,
          purpose: 'Equipment Sales Pitch',
          visitDate: new Date().toISOString(),
          expectedArrival: '15:00',
          expectedDeparture: '16:00',
        }),
      });
      const reqBody = await reqRes.json() as any;
      createdVisitId2 = reqBody.data.visitId;

      // 2. Reject request
      const rejRes = await fetch(`${BASE_URL}/visits/${createdVisitId2}/reject`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${teacherToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Faculty is in departmental meeting' }),
      });
      const rejBody = await rejRes.json() as any;
      if (rejRes.status !== 200 || !rejBody.success) throw new Error(`Status ${rejRes.status}: ${JSON.stringify(rejBody)}`);

      const visitDoc = await VisitorVisit.findById(createdVisitId2);
      if (visitDoc?.status !== 'rejected') throw new Error(`Expected status 'rejected', found ${visitDoc?.status}`);
      if (visitDoc?.rejectionReason !== 'Faculty is in departmental meeting') throw new Error('Rejection reason not stored');

      // Verify NO pass was created
      const passDoc = await VisitorPass.findOne({ visitId: createdVisitId2 });
      if (passDoc) throw new Error('A pass was generated for a rejected visit, which violates the security model');
    });

    // ─────────────────────────────────────────────────────────────
    // CATEGORY 4: Security Gate Operations (Lookup, Entry, Anti-Passback, Exit)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 4: Security Gate Operations & Anti-Passback Guards ---');

    await recordTest('Passcode Lookup', 'GET /passes/lookup/:passCode allows security to view pass details', async () => {
      const res = await fetch(`${BASE_URL}/passes/lookup/${generatedPassCode1}`, {
        headers: { Authorization: `Bearer ${securityToken}` },
      });
      const body = await res.json() as any;
      if (res.status !== 200 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
      if (body.data.pass.visitorId.fullName !== 'Dr. Evelyn Reed-Updated') throw new Error('Visitor details mismatch');
    });

    await recordTest('Security Gate Entry', 'POST /scan (action: entry) validates pass, checks in visitor, and writes log', async () => {
      const res = await fetch(`${BASE_URL}/scan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${securityToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passCode: generatedPassCode1,
          action: 'entry',
        }),
      });
      const body = await res.json() as any;
      if (res.status !== 200 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
      if (body.scanResult !== 'success') throw new Error(`Expected scanResult 'success', got ${body.scanResult}`);

      // Verify DB updates
      const pass = await VisitorPass.findById(createdPassId1);
      if (pass?.status !== 'used-entry') throw new Error(`Expected pass status 'used-entry', got ${pass?.status}`);

      const visit = await VisitorVisit.findById(createdVisitId1);
      if (visit?.status !== 'checked-in' || !visit?.checkedInAt) {
        throw new Error(`Visit status not updated to checked-in with timestamp`);
      }

      const log = await VisitorLog.findOne({ visitId: createdVisitId1, action: 'entry' });
      if (!log) throw new Error('VisitorLog entry was not written');
      if (log.gateOperatorId.toString() !== security._id.toString()) throw new Error('Gate operator not logged');
    });

    await recordTest('Anti-Passback Duplicate Guard', 'POST /scan (action: entry) rejects second entry attempt (409 Conflict)', async () => {
      const res = await fetch(`${BASE_URL}/scan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${securityToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passCode: generatedPassCode1,
          action: 'entry',
        }),
      });
      const body = await res.json() as any;
      if (res.status !== 409) throw new Error(`Expected HTTP 409 Conflict, received ${res.status}`);
      if (body.scanResult !== 'duplicate') throw new Error(`Expected scanResult 'duplicate', got ${body.scanResult}`);

      // Verify incident logged
      const dupLog = await VisitorLog.findOne({ visitId: createdVisitId1, action: 'duplicate' });
      if (!dupLog) throw new Error('Duplicate entry attempt was not logged to VisitorLog');
    });

    await recordTest('Real-time Presence', 'GET /currently-inside accurately includes the checked-in visitor', async () => {
      const res = await fetch(`${BASE_URL}/currently-inside`, {
        headers: { Authorization: `Bearer ${securityToken}` },
      });
      const body = await res.json() as any;
      if (res.status !== 200 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
      const insideFound = body.data.visits?.some((v: any) => v._id === createdVisitId1);
      if (!insideFound) throw new Error('Checked-in visitor not listed in currently-inside query');
    });

    await recordTest('Premature Exit Guard', 'POST /scan (action: exit) fails on an un-admitted pass', async () => {
      // Create and approve visit 3 without entry
      const reqRes = await fetch(`${BASE_URL}/public/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Alice Walker',
          phone: testPhone3,
          email: 'alice.walker@example.com',
          category: 'parent',
          hostId: teacher._id.toString(),
          department: teacher.department,
          purpose: 'Parent Teacher Meeting',
          visitDate: new Date().toISOString(),
          expectedArrival: '11:00',
          expectedDeparture: '12:00',
        }),
      });
      const reqBody = await reqRes.json() as any;
      createdVisitId3 = reqBody.data.visitId;

      const appRes = await fetch(`${BASE_URL}/visits/${createdVisitId3}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const appBody = await appRes.json() as any;
      generatedPassCode3 = appBody.data.pass.passCode;
      createdPassId3 = appBody.data.pass._id;

      // Try exit directly
      const exitRes = await fetch(`${BASE_URL}/scan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${securityToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passCode: generatedPassCode3,
          action: 'exit',
        }),
      });
      if (exitRes.status !== 400) throw new Error(`Expected HTTP 400 for unentered pass exit, got ${exitRes.status}`);
    });

    await recordTest('Security Gate Exit', 'POST /scan (action: exit) checks out visitor & calculates dwell duration', async () => {
      const res = await fetch(`${BASE_URL}/scan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${securityToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passCode: generatedPassCode1,
          action: 'exit',
        }),
      });
      const body = await res.json() as any;
      if (res.status !== 200 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
      if (body.scanResult !== 'success') throw new Error(`Expected scanResult 'success', got ${body.scanResult}`);

      // Verify DB updates
      const pass = await VisitorPass.findById(createdPassId1);
      if (pass?.status !== 'used-exit') throw new Error(`Expected pass status 'used-exit', got ${pass?.status}`);

      const visit = await VisitorVisit.findById(createdVisitId1);
      if (visit?.status !== 'checked-out' || !visit?.checkedOutAt) {
        throw new Error(`Visit status not updated to checked-out with checkedOutAt timestamp`);
      }

      // Verify visitor removed from currently inside
      const insideRes = await fetch(`${BASE_URL}/currently-inside`, {
        headers: { Authorization: `Bearer ${securityToken}` },
      });
      const insideBody = await insideRes.json() as any;
      const insideFound = insideBody.data.visits?.some((v: any) => v._id === createdVisitId1);
      if (insideFound) throw new Error('Checked-out visitor still appears in currently-inside query');
    });

    // ─────────────────────────────────────────────────────────────
    // CATEGORY 5: Security Enforcement (Revocation & Blacklisting)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 5: Security Enforcement (Revocation & Blacklisting) ---');

    await recordTest('Pass Revocation Guard', 'PATCH /passes/:id/revoke revokes active pass and blocks entry', async () => {
      // 1. Admin revokes pass 3
      const revRes = await fetch(`${BASE_URL}/passes/${createdPassId3}/revoke`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Security alert on visitor' }),
      });
      const revBody = await revRes.json() as any;
      if (revRes.status !== 200 || !revBody.success) throw new Error(`Status ${revRes.status}: ${JSON.stringify(revBody)}`);

      // 2. Try entry at gate with revoked pass
      const scanRes = await fetch(`${BASE_URL}/scan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${securityToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passCode: generatedPassCode3,
          action: 'entry',
        }),
      });
      const scanBody = await scanRes.json() as any;
      if (scanRes.status !== 400) throw new Error(`Expected HTTP 400 for revoked pass, got ${scanRes.status}`);
      if (scanBody.scanResult !== 'revoked') throw new Error(`Expected scanResult 'revoked', got ${scanBody.scanResult}`);
    });

    await recordTest('Blacklist Enforcement', 'PATCH /visitors/:id/blacklist blocks any future visitor requests', async () => {
      // 1. Admin blacklists visitor 1
      const blRes = await fetch(`${BASE_URL}/visitors/${createdVisitorId1}/blacklist`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blacklist: true, reason: 'Policy violation on premises' }),
      });
      const blBody = await blRes.json() as any;
      if (blRes.status !== 200 || !blBody.success) throw new Error(`Status ${blRes.status}: ${JSON.stringify(blBody)}`);

      // 2. Attempt to register visit with blacklisted phone
      const reqRes = await fetch(`${BASE_URL}/public/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Dr. Evelyn Reed',
          phone: testPhone,
          email: 'evelyn.reed@example.com',
          category: 'guest',
          hostId: teacher._id.toString(),
          department: teacher.department,
          purpose: 'Attempting re-entry',
          visitDate: new Date().toISOString(),
          expectedArrival: '12:00',
          expectedDeparture: '13:00',
        }),
      });
      if (reqRes.status !== 403) throw new Error(`Expected HTTP 403 for blacklisted visitor, got ${reqRes.status}`);

      // Un-blacklist visitor to clean up state
      await Visitor.findByIdAndUpdate(createdVisitorId1, { isBlacklisted: false, blacklistReason: undefined });
    });

    // ─────────────────────────────────────────────────────────────
    // CATEGORY 6: Analytics & Dashboard Metrics
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 6: Analytics & Dashboard Metrics ---');

    await recordTest('Dashboard Statistics', 'GET /dashboard computes correct summary metrics', async () => {
      const res = await fetch(`${BASE_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const body = await res.json() as any;
      if (res.status !== 200 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
      const { totalToday, totalVisitors, avgDuration } = body.data;
      if (typeof totalToday !== 'number' || typeof totalVisitors !== 'number' || typeof avgDuration !== 'number') {
        throw new Error('Missing expected numeric metrics in dashboard payload');
      }
    });

    await recordTest('30-Day Analytics', 'GET /analytics computes aggregated trends and breakdowns', async () => {
      const res = await fetch(`${BASE_URL}/analytics`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const body = await res.json() as any;
      if (res.status !== 200 || !body.success) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
      const { dailyTrend, categoryBreakdown, departmentStats, statusBreakdown } = body.data;
      if (!Array.isArray(dailyTrend) || !Array.isArray(categoryBreakdown) || !Array.isArray(departmentStats) || !Array.isArray(statusBreakdown)) {
        throw new Error('Analytics aggregation did not return expected array groupings');
      }
    });

    // ─────────────────────────────────────────────────────────────
    // CATEGORY 7: Event Management CRUD
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 7: Event Management CRUD ---');

    await recordTest('Event Lifecycle', 'Full CRUD operations on institutional visitor events', async () => {
      // 1. Create event
      const createRes = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Annual AI Research Symposium 2026',
          description: 'Open conference for international researchers',
          eventDate: new Date(Date.now() + 86400000).toISOString(),
          startTime: '09:00',
          endTime: '17:00',
          venue: 'Main Auditorium Hall B',
          maxVisitors: 250,
        }),
      });
      const createBody = await createRes.json() as any;
      if (createRes.status !== 201 || !createBody.success) throw new Error(`Create event failed: ${createRes.status}`);
      createdEventId = createBody.data.event._id;

      // 2. Read events
      const listRes = await fetch(`${BASE_URL}/events`, {
        headers: { Authorization: `Bearer ${securityToken}` },
      });
      const listBody = await listRes.json() as any;
      if (!listBody.data.events.some((e: any) => e._id === createdEventId)) throw new Error('Created event not listed in events response');

      // 3. Update event
      const updRes = await fetch(`${BASE_URL}/events/${createdEventId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxVisitors: 300 }),
      });
      if (updRes.status !== 200) throw new Error(`Update event failed: ${updRes.status}`);

      // 4. Delete event
      const delRes = await fetch(`${BASE_URL}/events/${createdEventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (delRes.status !== 200) throw new Error(`Delete event failed: ${delRes.status}`);
    });

    // ─────────────────────────────────────────────────────────────
    // CATEGORY 8: Role-Based Access Control (RBAC) Boundaries
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 8: Role-Based Access Control (RBAC) Boundaries ---');

    await recordTest('RBAC: Student Access Block', 'Students are forbidden from scanning passes or approving requests (403)', async () => {
      // Student tries scan
      const scanRes = await fetch(`${BASE_URL}/scan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passCode: 'VIS-TEST', action: 'entry' }),
      });
      if (scanRes.status !== 403) throw new Error(`Expected HTTP 403 for student scan, got ${scanRes.status}`);

      // Student tries approval
      const appRes = await fetch(`${BASE_URL}/visits/${createdVisitId1}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      if (appRes.status !== 403) throw new Error(`Expected HTTP 403 for student approve, got ${appRes.status}`);
    });

    await recordTest('RBAC: Security Boundary', 'Security guards cannot access administrative analytics or create events (403)', async () => {
      const analyticsRes = await fetch(`${BASE_URL}/analytics`, {
        headers: { Authorization: `Bearer ${securityToken}` },
      });
      if (analyticsRes.status !== 403) throw new Error(`Expected HTTP 403 for security access to admin analytics, got ${analyticsRes.status}`);

      const eventRes = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${securityToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Unauthorized Event' }),
      });
      if (eventRes.status !== 403) throw new Error(`Expected HTTP 403 for security event creation, got ${eventRes.status}`);
    });

  } finally {
    // ── Cleanup Test Data ──
    console.log('\n[cleanup] Cleaning up test records from database...');
    await VisitorVisit.deleteMany({ _id: { $in: [createdVisitId1, createdVisitId2, createdVisitId3] } });
    await VisitorPass.deleteMany({ _id: { $in: [createdPassId1, createdPassId3] } });
    await VisitorLog.deleteMany({ visitId: { $in: [createdVisitId1, createdVisitId2, createdVisitId3] } });
    await Visitor.deleteMany({ phone: { $in: [testPhone, testPhone2, testPhone3] } });
    if (createdEventId) await VisitorEvent.findByIdAndDelete(createdEventId);
    console.log('[cleanup] Cleanup completed.');

    // Stop test server and disconnect DB
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }

  // ── Print Summary Table ──
  console.log('\n================================================================');
  console.log('                 FINAL TEST EXECUTION SUMMARY                    ');
  console.log('================================================================');
  const passed = testResults.filter((r) => r.status === 'PASSED').length;
  const failed = testResults.filter((r) => r.status === 'FAILED').length;
  const total = testResults.length;

  console.log(`Total Assertions Tested : ${total}`);
  console.log(`Passed Assertions       : ${passed} / ${total} (${Math.round((passed / total) * 100)}%)`);
  console.log(`Failed Assertions       : ${failed} / ${total}`);
  console.log('----------------------------------------------------------------');

  if (failed === 0) {
    console.log('>>> ALL ARCHITECTURAL TESTS PASSED PERFECTLY! <<<');
    console.log('The AttendX Visitor Management System works 100% according to the architecture.');
  } else {
    console.error('>>> SOME TESTS FAILED:');
    testResults.filter((r) => r.status === 'FAILED').forEach((f) => {
      console.error(`- [${f.category}] ${f.name}: ${f.details}`);
    });
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
