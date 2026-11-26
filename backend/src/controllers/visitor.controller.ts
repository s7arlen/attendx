import { Response, Request } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User.model';
import { Visitor } from '../models/Visitor.model';
import { VisitorVisit } from '../models/VisitorVisit.model';
import { VisitorPass } from '../models/VisitorPass.model';
import { VisitorLog } from '../models/VisitorLog.model';
import { VisitorEvent } from '../models/VisitorEvent.model';
import { createNotification } from '../utils/notificationHelper';
import { createAuditLog, getClientIp } from '../utils/auditLogger';
import { emitToUser } from '../config/socket';
import { generateVisitorToken, hashToken, generatePassCode, generateVisitorQRCode } from '../utils/visitorQR';
import { sendVisitorRequestEmail, sendVisitorApprovedEmail, sendVisitorRejectedEmail } from '../utils/mailer';
import { clampPagination, escapeRegex, isValidObjectId } from '../utils/security';
import { Server } from 'socket.io';

const populateVisit = (q: any) =>
  q
    .populate('visitorId', 'fullName phone email category photo')
    .populate('hostId', 'name email department')
    .populate('registeredBy', 'name role')
    .populate('approvedBy', 'name')
    .populate('rejectedBy', 'name');

const updateEventSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(1000).optional(),
  eventDate: z.string().optional(),
  startTime: z.string().max(20).optional(),
  endTime: z.string().max(20).optional(),
  venue: z.string().max(150).optional(),
  maxVisitors: z.coerce.number().int().min(1).max(10000).optional(),
  isActive: z.boolean().optional(),
});

const publicVisitorRequestSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().min(6).max(30),
  email: z.string().email(),
  category: z.enum(['guest', 'vendor', 'parent', 'official', 'delivery', 'interview', 'contractor', 'other']).default('guest'),
  nationalId: z.string().max(50).optional(),
  address: z.string().max(300).optional(),
  company: z.string().max(150).optional(),
  hostId: z.string().refine(isValidObjectId, 'Invalid host ID'),
  purpose: z.string().min(3).max(500),
  department: z.string().min(1).max(100),
  visitDate: z.string().min(1),
  expectedArrival: z.string().min(1).max(30),
  expectedDeparture: z.string().min(1).max(30),
  accompanyingCount: z.coerce.number().int().min(0).max(50).optional().default(0),
  notes: z.string().max(500).optional(),
});

// ─────────────────────────────────────────────────────────────
// VISITOR DASHBOARD STATS
// ─────────────────────────────────────────────────────────────
export const getVisitorDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalToday, pendingApprovals, currentlyInside,
      expectedToday, rejectedToday, totalVisitors,
    ] = await Promise.all([
      VisitorVisit.countDocuments({ visitDate: { $gte: today, $lt: tomorrow } }),
      VisitorVisit.countDocuments({ status: 'pending' }),
      VisitorVisit.countDocuments({ status: 'checked-in' }),
      VisitorVisit.countDocuments({ status: 'approved', visitDate: { $gte: today, $lt: tomorrow } }),
      VisitorVisit.countDocuments({ status: 'rejected', visitDate: { $gte: today, $lt: tomorrow } }),
      Visitor.countDocuments(),
    ]);

    const completedVisits = await VisitorVisit.find({
      status: 'checked-out',
      checkedInAt: { $exists: true },
      checkedOutAt: { $exists: true },
    }).select('checkedInAt checkedOutAt').limit(200);

    let avgDuration = 0;
    if (completedVisits.length > 0) {
      const totalMs = completedVisits.reduce((sum, v) => {
        return sum + (v.checkedOutAt!.getTime() - v.checkedInAt!.getTime());
      }, 0);
      avgDuration = Math.round(totalMs / completedVisits.length / 60000);
    }

    const recentVisits = await populateVisit(
      VisitorVisit.find().sort({ createdAt: -1 }).limit(5)
    );

    res.json({
      success: true,
      data: {
        totalToday, pendingApprovals, currentlyInside, expectedToday,
        rejectedToday, totalVisitors, avgDuration, recentVisits,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load visitor dashboard' });
  }
};

// ─────────────────────────────────────────────────────────────
// REGISTER VISITOR & CREATE VISIT
// ─────────────────────────────────────────────────────────────
export const registerVisitor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      fullName, phone, email, category, nationalId, address, company, notes,
      hostId, purpose, department, visitDate, expectedArrival, expectedDeparture,
      accompanyingCount, visitType, eventId,
    } = req.body;

    if (!fullName || !phone || !category || !isValidObjectId(hostId) || !purpose || !department || !visitDate || !expectedArrival || !expectedDeparture) {
      res.status(400).json({ success: false, message: 'Missing or invalid required fields' });
      return;
    }

    const host = await User.findById(hostId);
    if (!host) {
      res.status(404).json({ success: false, message: 'Host user not found' });
      return;
    }

    let visitor = await Visitor.findOne({ phone: String(phone) });
    if (!visitor) {
      visitor = await Visitor.create({ fullName, phone, email, category, nationalId, address, company, notes });
    } else {
      visitor.fullName = fullName;
      visitor.email = email || visitor.email;
      visitor.category = category;
      if (nationalId) visitor.nationalId = nationalId;
      await visitor.save();
    }

    if (visitor.isBlacklisted) {
      res.status(403).json({ success: false, message: `Visitor is blacklisted. Reason: ${visitor.blacklistReason || 'Not specified'}` });
      return;
    }

    const visit = await VisitorVisit.create({
      visitorId: visitor._id,
      hostId,
      registeredBy: req.user!.userId,
      visitType: visitType || 'pre-registered',
      purpose,
      department,
      visitDate: new Date(visitDate),
      expectedArrival,
      expectedDeparture,
      accompanyingCount: accompanyingCount || 0,
      status: 'pending',
      eventId: isValidObjectId(eventId) ? eventId : undefined,
    });

    await createNotification(
      hostId,
      'New Visitor Request',
      `${fullName} (${phone}) has requested a visit. Purpose: ${purpose}`,
      'info',
      `/visitor/approvals`
    );

    const io: Server = req.app.get('io');
    emitToUser(io, hostId, 'visitor:new_request', {
      visitId: visit._id,
      visitorName: fullName,
      purpose,
      visitDate,
    });

    await createAuditLog(req.user!.userId, 'REGISTER_VISITOR', 'VisitorVisit', visit._id.toString(), { visitorName: fullName, hostId }, getClientIp(req));

    const populated = await populateVisit(VisitorVisit.findById(visit._id));
    res.status(201).json({ success: true, message: 'Visitor registered successfully', data: { visit: populated } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to register visitor' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET ALL VISITS (admin/security)
// ─────────────────────────────────────────────────────────────
export const getAllVisits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, date, search } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 20, 100);
    const query: any = {};

    if (status && typeof status === 'string') query.status = status;

    if (date && typeof date === 'string') {
      const d = new Date(date); d.setHours(0, 0, 0, 0);
      const nd = new Date(d); nd.setDate(nd.getDate() + 1);
      query.visitDate = { $gte: d, $lt: nd };
    }

    if (req.query.today === '1') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      query.visitDate = { $gte: today, $lt: tomorrow };
    }

    if (search && typeof search === 'string') {
      const safe = escapeRegex(search.trim());
      const matchingVisitors = await Visitor.find({
        $or: [
          { fullName: { $regex: safe, $options: 'i' } },
          { phone: { $regex: safe, $options: 'i' } },
          { email: { $regex: safe, $options: 'i' } },
        ],
      }).select('_id');
      query.visitorId = { $in: matchingVisitors.map(v => v._id) };
    }

    const [visits, total] = await Promise.all([
      populateVisit(VisitorVisit.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)),
      VisitorVisit.countDocuments(query),
    ]);

    res.json({ success: true, data: { visits, total, page, limit } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load visits' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET VISITS FOR HOST (teacher sees their own requests)
// ─────────────────────────────────────────────────────────────
export const getMyVisitorRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const query: any = { hostId: req.user!.userId };
    if (status && typeof status === 'string') query.status = status;

    const visits = await populateVisit(VisitorVisit.find(query).sort({ createdAt: -1 }).limit(50));
    res.json({ success: true, data: { visits } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load visitor requests' });
  }
};

// ─────────────────────────────────────────────────────────────
// APPROVE VISIT — host (teacher) or admin
// ─────────────────────────────────────────────────────────────
export const approveVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    if (!isValidObjectId(visitId)) { res.status(400).json({ success: false, message: 'Invalid visit ID' }); return; }
    const visit = await VisitorVisit.findById(visitId).populate('visitorId', 'fullName phone');

    if (!visit) { res.status(404).json({ success: false, message: 'Visit not found' }); return; }
    if (visit.status !== 'pending') {
      res.status(400).json({ success: false, message: `Visit is already ${visit.status}` }); return;
    }

    const isHost = visit.hostId.toString() === req.user!.userId;
    const isAdmin = req.user!.role === 'admin';
    if (!isHost && !isAdmin) {
      res.status(403).json({ success: false, message: 'Only the host or admin can approve' }); return;
    }

    visit.status = 'approved';
    visit.approvedBy = req.user!.userId as any;
    visit.approvedAt = new Date();
    await visit.save();

    const rawToken = generateVisitorToken();
    const tokenHash = hashToken(rawToken);
    let passCode = generatePassCode();
    while (await VisitorPass.findOne({ passCode })) {
      passCode = generatePassCode();
    }
    const qrCodeData = await generateVisitorQRCode(passCode);

    const visitDate = new Date(visit.visitDate);
    const visitDateEnd = new Date(visitDate); visitDateEnd.setDate(visitDateEnd.getDate() + 1);

    const pass = await VisitorPass.create({
      visitId: visit._id,
      visitorId: visit.visitorId,
      tokenHash,
      qrCodeData,
      passCode,
      status: 'active',
      validFrom: visitDate,
      validUntil: visitDateEnd,
    });

    const visitor = visit.visitorId as any;
    await createNotification(
      visit.registeredBy.toString(),
      'Visitor Approved',
      `Visit for ${visitor.fullName} has been approved. Pass code: ${passCode}`,
      'success',
      `/visitor/passes`
    );

    const io: Server = req.app.get('io');
    emitToUser(io, visit.registeredBy.toString(), 'visitor:approved', {
      visitId: visit._id, passCode, visitorName: visitor.fullName,
    });

    await createAuditLog(req.user!.userId, 'APPROVE_VISIT', 'VisitorVisit', visitId, { passCode }, getClientIp(req));

    const visitorDoc = await Visitor.findById(visit.visitorId);
    const hostDoc    = await User.findById(visit.hostId).select('name');
    if (visitorDoc?.email && hostDoc) {
      const dateStr = new Date(visit.visitDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      sendVisitorApprovedEmail(
        visitorDoc.email, visitorDoc.fullName, hostDoc.name,
        dateStr, passCode, pass.qrCodeData
      ).catch(() => {});
    }

    const passSafe = pass.toObject();
    delete (passSafe as any).tokenHash;
    res.json({
      success: true,
      message: 'Visit approved and QR pass generated',
      data: { visit, pass: passSafe },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to approve visit' });
  }
};

// ─────────────────────────────────────────────────────────────
// REJECT VISIT
// ─────────────────────────────────────────────────────────────
export const rejectVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    if (!isValidObjectId(visitId)) { res.status(400).json({ success: false, message: 'Invalid visit ID' }); return; }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : undefined;

    const visit = await VisitorVisit.findById(visitId).populate('visitorId', 'fullName');
    if (!visit) { res.status(404).json({ success: false, message: 'Visit not found' }); return; }
    if (visit.status !== 'pending') {
      res.status(400).json({ success: false, message: `Visit is already ${visit.status}` }); return;
    }

    const isHost = visit.hostId.toString() === req.user!.userId;
    const isAdmin = req.user!.role === 'admin';
    if (!isHost && !isAdmin) {
      res.status(403).json({ success: false, message: 'Only the host or admin can reject' }); return;
    }

    visit.status = 'rejected';
    visit.rejectedBy = req.user!.userId as any;
    visit.rejectedAt = new Date();
    visit.rejectionReason = reason;
    await visit.save();

    const visitor = visit.visitorId as any;
    await createNotification(
      visit.registeredBy.toString(),
      'Visitor Rejected',
      `Visit for ${visitor.fullName} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
      'warning',
      `/visitor/approvals`
    );

    const io: Server = req.app.get('io');
    emitToUser(io, visit.registeredBy.toString(), 'visitor:rejected', {
      visitId: visit._id, visitorName: visitor.fullName, reason,
    });

    await createAuditLog(req.user!.userId, 'REJECT_VISIT', 'VisitorVisit', visitId, { reason }, getClientIp(req));

    const visitorDoc = await Visitor.findById(visit.visitorId);
    const hostDoc = await User.findById(visit.hostId).select('name');
    if (visitorDoc?.email) {
      sendVisitorRejectedEmail(visitorDoc.email, visitorDoc.fullName, hostDoc?.name || '', reason).catch(() => {});
    }

    res.json({ success: true, message: 'Visit rejected', data: { visit } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to reject visit' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET VISITOR PASS by visitId (ownership verified)
// ─────────────────────────────────────────────────────────────
export const getVisitorPass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    if (!isValidObjectId(visitId)) { res.status(400).json({ success: false, message: 'Invalid visit ID' }); return; }
    const visit = await VisitorVisit.findById(visitId).select('hostId');
    if (!visit) { res.status(404).json({ success: false, message: 'Visit not found' }); return; }
    if (req.user!.role === 'teacher' && visit.hostId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized for this visit' }); return;
    }
    const pass = await VisitorPass.findOne({ visitId })
      .select('-tokenHash')
      .populate('visitId')
      .populate('visitorId', 'fullName phone email category');
    if (!pass) { res.status(404).json({ success: false, message: 'Pass not found' }); return; }
    res.json({ success: true, data: { pass } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load pass' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET ALL ACTIVE PASSES
// ─────────────────────────────────────────────────────────────
export const getAllPasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 20, 100);
    const query: any = {};
    if (status && typeof status === 'string') query.status = status;

    const [passes, total] = await Promise.all([
      VisitorPass.find(query)
        .select('-tokenHash')
        .populate('visitorId', 'fullName phone email category')
        .populate({ path: 'visitId', populate: { path: 'hostId', select: 'name department' } })
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit),
      VisitorPass.countDocuments(query),
    ]);
    res.json({ success: true, data: { passes, total, page, limit } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load passes' });
  }
};

// ─────────────────────────────────────────────────────────────
// SCAN QR — ENTRY or EXIT (security gate)
// ─────────────────────────────────────────────────────────────
export const scanVisitorQR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { passCode, action } = req.body;

    if (!passCode || typeof passCode !== 'string' || !['entry', 'exit'].includes(action)) {
      res.status(400).json({ success: false, message: 'passCode and action (entry|exit) are required' });
      return;
    }

    const pass = await VisitorPass.findOne({ passCode: passCode.toUpperCase() })
      .populate('visitorId', 'fullName phone email category photo isBlacklisted')
      .populate({
        path: 'visitId',
        populate: [
          { path: 'hostId', select: 'name department' },
          { path: 'visitorId', select: 'fullName' },
        ],
      });

    if (!pass) {
      await VisitorLog.create({
        visitId: isValidObjectId(req.body.visitId) ? req.body.visitId : new (require('mongoose').Types.ObjectId)(),
        visitorId: isValidObjectId(req.body.visitorId) ? req.body.visitorId : new (require('mongoose').Types.ObjectId)(),
        action: 'denied',
        timestamp: new Date(),
        gateOperatorId: req.user!.userId,
        scanMethod: 'qr',
        ipAddress: getClientIp(req),
        denied_reason: 'Pass not found',
      }).catch(() => {});
      res.status(404).json({ success: false, message: 'QR pass not found', scanResult: 'invalid' });
      return;
    }

    const visitor = pass.visitorId as any;
    const visit = pass.visitId as any;

    if (visitor.isBlacklisted) {
      res.status(403).json({ success: false, message: 'Visitor is blacklisted', scanResult: 'denied', visitor });
      return;
    }
    if (pass.status === 'revoked') {
      res.status(400).json({ success: false, message: 'Pass has been revoked', scanResult: 'revoked', visitor });
      return;
    }
    if (pass.status === 'expired' || new Date() > pass.validUntil) {
      pass.status = 'expired'; await pass.save();
      res.status(400).json({ success: false, message: 'Pass has expired', scanResult: 'expired', visitor });
      return;
    }
    if (!['approved', 'checked-in'].includes(visit.status)) {
      res.status(400).json({ success: false, message: `Visit is ${visit.status}`, scanResult: 'invalid', visitor });
      return;
    }

    if (action === 'entry' && pass.status === 'used-entry') {
      await VisitorLog.create({
        visitId: visit._id, visitorId: visitor._id, passId: pass._id,
        action: 'duplicate', timestamp: new Date(),
        gateOperatorId: req.user!.userId, scanMethod: 'qr',
        ipAddress: getClientIp(req), denied_reason: 'Already checked in',
      });
      res.status(409).json({ success: false, message: 'Visitor already checked in', scanResult: 'duplicate', visitor });
      return;
    }
    if (action === 'exit' && pass.status !== 'used-entry') {
      res.status(400).json({ success: false, message: 'Visitor has not checked in yet', scanResult: 'invalid', visitor });
      return;
    }

    const now = new Date();
    if (action === 'entry') {
      pass.status = 'used-entry';
      await pass.save();
      visit.status = 'checked-in';
      visit.checkedInAt = now;
      await visit.save();
    } else {
      pass.status = 'used-exit';
      await pass.save();
      visit.status = 'checked-out';
      visit.checkedOutAt = now;
      await visit.save();
    }

    await VisitorLog.create({
      visitId: visit._id, visitorId: visitor._id, passId: pass._id,
      action, timestamp: now,
      gateOperatorId: req.user!.userId, scanMethod: 'qr',
      ipAddress: getClientIp(req),
    });

    if (action === 'entry') {
      await createNotification(
        visit.hostId._id.toString(),
        'Your Visitor Has Arrived',
        `${visitor.fullName} has checked in at the gate.`,
        'info',
        `/visitor/history`
      );
      const io: Server = req.app.get('io');
      emitToUser(io, visit.hostId._id.toString(), 'visitor:arrived', {
        visitId: visit._id, visitorName: visitor.fullName, checkedInAt: now,
      });
    }

    await createAuditLog(req.user!.userId, action === 'entry' ? 'VISITOR_ENTRY' : 'VISITOR_EXIT', 'VisitorLog', pass._id.toString(), { passCode, visitorName: visitor.fullName }, getClientIp(req));

    res.json({
      success: true,
      message: action === 'entry' ? 'Entry recorded' : 'Exit recorded',
      scanResult: 'success',
      data: { visitor, visit, action, timestamp: now },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to process QR scan' });
  }
};

// ─────────────────────────────────────────────────────────────
// MANUAL LOOKUP by pass code
// ─────────────────────────────────────────────────────────────
export const lookupVisitorByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { passCode } = req.params;
    const pass = await VisitorPass.findOne({ passCode: passCode.toUpperCase() })
      .select('-tokenHash')
      .populate('visitorId', 'fullName phone email category photo')
      .populate({ path: 'visitId', populate: { path: 'hostId', select: 'name department' } });

    if (!pass) { res.status(404).json({ success: false, message: 'Pass not found' }); return; }
    res.json({ success: true, data: { pass } });
  } catch {
    res.status(500).json({ success: false, message: 'Lookup failed' });
  }
};

// ─────────────────────────────────────────────────────────────
// REVOKE PASS
// ─────────────────────────────────────────────────────────────
export const revokePass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { passId } = req.params;
    if (!isValidObjectId(passId)) { res.status(400).json({ success: false, message: 'Invalid pass ID' }); return; }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : undefined;

    const pass = await VisitorPass.findById(passId).select('-tokenHash').populate('visitorId', 'fullName');
    if (!pass) { res.status(404).json({ success: false, message: 'Pass not found' }); return; }
    if (['revoked', 'expired'].includes(pass.status)) {
      res.status(400).json({ success: false, message: `Pass is already ${pass.status}` }); return;
    }

    pass.status = 'revoked';
    pass.revokedBy = req.user!.userId as any;
    pass.revokedAt = new Date();
    pass.revocationReason = reason;
    await pass.save();

    const visit = await VisitorVisit.findById(pass.visitId);
    if (visit && visit.status === 'checked-in') {
      visit.status = 'checked-out';
      visit.checkedOutAt = new Date();
      await visit.save();
    }

    await createAuditLog(req.user!.userId, 'REVOKE_PASS', 'VisitorPass', passId, { reason }, getClientIp(req));

    res.json({ success: true, message: 'Pass revoked', data: { pass } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to revoke pass' });
  }
};

// ─────────────────────────────────────────────────────────────
// CURRENTLY INSIDE CAMPUS
// ─────────────────────────────────────────────────────────────
export const getCurrentlyInside = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const visits = await populateVisit(
      VisitorVisit.find({ status: 'checked-in' }).sort({ checkedInAt: -1 })
    );
    res.json({ success: true, data: { visits, total: visits.length } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load currently inside' });
  }
};

// ─────────────────────────────────────────────────────────────
// ENTRY & EXIT HISTORY
// ─────────────────────────────────────────────────────────────
export const getVisitorHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, action } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 30, 100);
    const query: any = {};

    if (action && typeof action === 'string') query.action = action;
    if (date && typeof date === 'string') {
      const d = new Date(date); d.setHours(0, 0, 0, 0);
      const nd = new Date(d); nd.setDate(nd.getDate() + 1);
      query.timestamp = { $gte: d, $lt: nd };
    }

    const [logs, total] = await Promise.all([
      VisitorLog.find(query)
        .populate('visitorId', 'fullName phone category')
        .populate('gateOperatorId', 'name role')
        .populate({ path: 'visitId', populate: { path: 'hostId', select: 'name department' } })
        .sort({ timestamp: -1 })
        .skip(skip).limit(limit),
      VisitorLog.countDocuments(query),
    ]);

    res.json({ success: true, data: { logs, total, page, limit } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load history' });
  }
};

// ─────────────────────────────────────────────────────────────
// VISITOR ANALYTICS
// ─────────────────────────────────────────────────────────────
export const getVisitorAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      dailyTrend, categoryBreakdown, departmentStats,
      statusBreakdown, totalThisMonth,
    ] = await Promise.all([
      VisitorVisit.aggregate([
        { $match: { visitDate: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$visitDate' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', count: 1, _id: 0 } },
      ]),
      VisitorVisit.aggregate([
        { $lookup: { from: 'visitors', localField: 'visitorId', foreignField: '_id', as: 'visitor' } },
        { $unwind: '$visitor' },
        { $group: { _id: '$visitor.category', count: { $sum: 1 } } },
        { $project: { category: '$_id', count: 1, _id: 0 } },
      ]),
      VisitorVisit.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $project: { department: '$_id', count: 1, _id: 0 } },
      ]),
      VisitorVisit.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } },
      ]),
      VisitorVisit.countDocuments({
        visitDate: { $gte: new Date(today.getFullYear(), today.getMonth(), 1) },
      }),
    ]);

    res.json({
      success: true,
      data: {
        dailyTrend, categoryBreakdown, departmentStats,
        statusBreakdown, totalThisMonth,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load visitor analytics' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET SINGLE VISIT (ownership verified for teachers)
// ─────────────────────────────────────────────────────────────
export const getVisitById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    if (!isValidObjectId(visitId)) { res.status(400).json({ success: false, message: 'Invalid visit ID' }); return; }
    const visit = await populateVisit(VisitorVisit.findById(visitId));
    if (!visit) { res.status(404).json({ success: false, message: 'Visit not found' }); return; }
    if (req.user!.role === 'teacher' && (visit.hostId as any)?._id?.toString() !== req.user!.userId && visit.hostId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, message: 'Not authorized for this visit' }); return;
    }
    const pass = await VisitorPass.findOne({ visitId: visit._id }).select('-tokenHash');
    res.json({ success: true, data: { visit, pass } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load visit' });
  }
};

// ─────────────────────────────────────────────────────────────
// EVENTS CRUD
// ─────────────────────────────────────────────────────────────
export const getEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const events = await VisitorEvent.find({ isActive: true })
      .populate('organizer', 'name department')
      .sort({ eventDate: 1 });
    res.json({ success: true, data: { events } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load events' });
  }
};

export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, eventDate, startTime, endTime, venue, maxVisitors } = req.body;
    if (!name || !eventDate || !startTime || !endTime || !venue) {
      res.status(400).json({ success: false, message: 'Missing required event fields' }); return;
    }
    const event = await VisitorEvent.create({
      name, description, eventDate: new Date(eventDate),
      startTime, endTime, venue, maxVisitors,
      organizer: req.user!.userId,
    });
    await createAuditLog(req.user!.userId, 'CREATE_EVENT', 'VisitorEvent', event._id.toString(), { name }, getClientIp(req));
    res.status(201).json({ success: true, data: { event } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    if (!isValidObjectId(eventId)) { res.status(400).json({ success: false, message: 'Invalid event ID' }); return; }
    const parsed = updateEventSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.issues }); return; }
    const event = await VisitorEvent.findByIdAndUpdate(eventId, { $set: parsed.data }, { new: true });
    if (!event) { res.status(404).json({ success: false, message: 'Event not found' }); return; }
    res.json({ success: true, data: { event } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    if (!isValidObjectId(eventId)) { res.status(400).json({ success: false, message: 'Invalid event ID' }); return; }
    await VisitorEvent.findByIdAndUpdate(eventId, { isActive: false });
    res.json({ success: true, message: 'Event deactivated' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET ALL VISITORS (directory)
// ─────────────────────────────────────────────────────────────
export const getVisitors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 20, 100);
    const query: any = {};
    if (search && typeof search === 'string') {
      const safe = escapeRegex(search.trim());
      query.$or = [
        { fullName: { $regex: safe, $options: 'i' } },
        { phone: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
      ];
    }
    const [visitors, total] = await Promise.all([
      Visitor.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Visitor.countDocuments(query),
    ]);
    res.json({ success: true, data: { visitors, total, page, limit } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load visitors' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET HOSTS LIST (for authenticated registration form dropdown)
// ─────────────────────────────────────────────────────────────
export const getHosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hosts = await User.find({ role: { $in: ['teacher', 'admin'] }, isActive: true })
      .select('name email department role')
      .sort({ name: 1 });
    res.json({ success: true, data: { hosts } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load hosts' });
  }
};

// ─────────────────────────────────────────────────────────────
// BLACKLIST / UN-BLACKLIST VISITOR
// ─────────────────────────────────────────────────────────────
export const toggleBlacklist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitorId } = req.params;
    if (!isValidObjectId(visitorId)) { res.status(400).json({ success: false, message: 'Invalid visitor ID' }); return; }
    const { blacklist, reason } = req.body;
    const visitor = await Visitor.findById(visitorId);
    if (!visitor) { res.status(404).json({ success: false, message: 'Visitor not found' }); return; }
    visitor.isBlacklisted = !!blacklist;
    visitor.blacklistReason = blacklist && typeof reason === 'string' ? reason.slice(0, 300) : undefined;
    await visitor.save();
    await createAuditLog(req.user!.userId, blacklist ? 'BLACKLIST_VISITOR' : 'UNBLACKLIST_VISITOR', 'Visitor', visitorId, { reason }, getClientIp(req));
    res.json({ success: true, message: `Visitor ${blacklist ? 'blacklisted' : 'removed from blacklist'}`, data: { visitor } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update blacklist status' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUBLIC: Visitor self-request (NO AUTH REQUIRED — rate limited)
// ─────────────────────────────────────────────────────────────
export const publicVisitorRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = publicVisitorRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid request fields', errors: parsed.error.issues });
      return;
    }

    const {
      fullName, phone, email, category, nationalId, address, company,
      hostId, purpose, department, visitDate, expectedArrival,
      expectedDeparture, accompanyingCount,
    } = parsed.data;

    const host = await User.findOne({ _id: hostId, role: { $in: ['teacher', 'admin'] }, isActive: true });
    if (!host) {
      res.status(404).json({ success: false, message: 'Selected host not found' });
      return;
    }

    let visitor = await Visitor.findOne({ phone });
    if (!visitor) {
      visitor = await Visitor.create({
        fullName, phone, email, category,
        nationalId, address, company,
      });
    } else {
      visitor.fullName = fullName;
      visitor.email    = email || visitor.email;
      if (nationalId) visitor.nationalId = nationalId;
      await visitor.save();
    }

    if (visitor.isBlacklisted) {
      res.status(403).json({ success: false, message: 'Your visit request cannot be processed at this time.' });
      return;
    }

    const adminUser = await User.findOne({ role: 'admin', isActive: true });
    if (!adminUser) {
      res.status(500).json({ success: false, message: 'Unable to process request' });
      return;
    }

    const visit = await VisitorVisit.create({
      visitorId:         visitor._id,
      hostId,
      registeredBy:      adminUser._id,
      visitType:         'pre-registered',
      purpose,
      department,
      visitDate:         new Date(visitDate),
      expectedArrival,
      expectedDeparture,
      accompanyingCount,
      status:            'pending',
    });

    await createNotification(
      hostId,
      'New Visitor Request',
      `${fullName} (${phone}) has requested a visit. Purpose: ${purpose}`,
      'info',
      `/visitor/approvals`
    );

    const io: Server = (req as any).app.get('io');
    if (io) {
      emitToUser(io, hostId, 'visitor:new_request', {
        visitId: visit._id, visitorName: fullName, purpose, visitDate,
      });
    }

    const dateStr = new Date(visitDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    sendVisitorRequestEmail(email, fullName, host.name, department, dateStr, purpose).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Your visit request has been submitted. The host will review and you will receive an email with your QR pass if approved.',
      data: { visitId: visit._id, status: 'pending' },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to submit visit request' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUBLIC: Get hosts list (no auth — omits staff emails)
// ─────────────────────────────────────────────────────────────
export const publicGetHosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const hosts = await User.find({ role: { $in: ['teacher', 'admin'] }, isActive: true })
      .select('name department role')
      .sort({ name: 1 });
    res.json({ success: true, data: { hosts } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load hosts' });
  }
};
