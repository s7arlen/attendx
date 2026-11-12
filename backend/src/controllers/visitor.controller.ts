import { Response } from 'express';
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
import { Server } from 'socket.io';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const populateVisit = (q: any) =>
  q
    .populate('visitorId', 'fullName phone email category photo')
    .populate('hostId', 'name email department')
    .populate('registeredBy', 'name role')
    .populate('approvedBy', 'name')
    .populate('rejectedBy', 'name');

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

    // Average visit duration from completed visits
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
      avgDuration = Math.round(totalMs / completedVisits.length / 60000); // minutes
    }

    // Recent visits
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// REGISTER VISITOR & CREATE VISIT
// ─────────────────────────────────────────────────────────────
export const registerVisitor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      // Visitor profile fields
      fullName, phone, email, category, nationalId, address, company, notes,
      // Visit fields
      hostId, purpose, department, visitDate, expectedArrival, expectedDeparture,
      accompanyingCount, visitType, eventId,
    } = req.body;

    if (!fullName || !phone || !category || !hostId || !purpose || !department || !visitDate || !expectedArrival || !expectedDeparture) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    // Verify host exists
    const host = await User.findById(hostId);
    if (!host) {
      res.status(404).json({ success: false, message: 'Host user not found' });
      return;
    }

    // Find or create visitor profile (match by phone)
    let visitor = await Visitor.findOne({ phone });
    if (!visitor) {
      visitor = await Visitor.create({ fullName, phone, email, category, nationalId, address, company, notes });
    } else {
      // Update contact info on repeat visits
      visitor.fullName = fullName;
      visitor.email = email || visitor.email;
      visitor.category = category;
      if (nationalId) visitor.nationalId = nationalId;
      await visitor.save();
    }

    // Check blacklist
    if (visitor.isBlacklisted) {
      res.status(403).json({ success: false, message: `Visitor is blacklisted. Reason: ${visitor.blacklistReason || 'Not specified'}` });
      return;
    }

    // Create visit
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
      eventId: eventId || undefined,
    });

    // Notify host
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET ALL VISITS (admin/security)
// ─────────────────────────────────────────────────────────────
export const getAllVisits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, date, search, page = 1, limit = 20 } = req.query;
    const query: any = {};

    if (status) query.status = status;

    if (date) {
      const d = new Date(date as string); d.setHours(0, 0, 0, 0);
      const nd = new Date(d); nd.setDate(nd.getDate() + 1);
      query.visitDate = { $gte: d, $lt: nd };
    }

    // If 'today' param
    if (req.query.today === '1') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      query.visitDate = { $gte: today, $lt: tomorrow };
    }

    const skip = (Number(page) - 1) * Number(limit);

    // If search, find matching visitor IDs first
    if (search) {
      const matchingVisitors = await Visitor.find({
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      query.visitorId = { $in: matchingVisitors.map(v => v._id) };
    }

    const [visits, total] = await Promise.all([
      populateVisit(VisitorVisit.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit))),
      VisitorVisit.countDocuments(query),
    ]);

    res.json({ success: true, data: { visits, total, page: Number(page), limit: Number(limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET VISITS FOR HOST (teacher sees their own requests)
// ─────────────────────────────────────────────────────────────
export const getMyVisitorRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const query: any = { hostId: req.user!.userId };
    if (status) query.status = status;

    const visits = await populateVisit(VisitorVisit.find(query).sort({ createdAt: -1 }).limit(50));
    res.json({ success: true, data: { visits } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// APPROVE VISIT — host (teacher) or admin
// ─────────────────────────────────────────────────────────────
export const approveVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    const visit = await VisitorVisit.findById(visitId).populate('visitorId', 'fullName phone');

    if (!visit) { res.status(404).json({ success: false, message: 'Visit not found' }); return; }
    if (visit.status !== 'pending') {
      res.status(400).json({ success: false, message: `Visit is already ${visit.status}` }); return;
    }

    // Only the host or admin can approve
    const isHost = visit.hostId.toString() === req.user!.userId;
    const isAdmin = req.user!.role === 'admin';
    if (!isHost && !isAdmin) {
      res.status(403).json({ success: false, message: 'Only the host or admin can approve' }); return;
    }

    // Update visit
    visit.status = 'approved';
    visit.approvedBy = req.user!.userId as any;
    visit.approvedAt = new Date();
    await visit.save();

    // Generate visitor pass
    const rawToken = generateVisitorToken();
    const tokenHash = hashToken(rawToken);
    let passCode = generatePassCode();
    // Ensure pass code uniqueness
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

    // Notify registrar (the person who submitted the visit)
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

    res.json({
      success: true,
      message: 'Visit approved and QR pass generated',
      data: { visit, pass: { ...pass.toObject(), rawToken } },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// REJECT VISIT
// ─────────────────────────────────────────────────────────────
export const rejectVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    const { reason } = req.body;

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

    res.json({ success: true, message: 'Visit rejected', data: { visit } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET VISITOR PASS by visitId
// ─────────────────────────────────────────────────────────────
export const getVisitorPass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    const pass = await VisitorPass.findOne({ visitId })
      .populate('visitId')
      .populate('visitorId', 'fullName phone email category');
    if (!pass) { res.status(404).json({ success: false, message: 'Pass not found' }); return; }
    res.json({ success: true, data: { pass } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET ALL ACTIVE PASSES
// ─────────────────────────────────────────────────────────────
export const getAllPasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query: any = {};
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [passes, total] = await Promise.all([
      VisitorPass.find(query)
        .populate('visitorId', 'fullName phone email category')
        .populate({ path: 'visitId', populate: { path: 'hostId', select: 'name department' } })
        .sort({ createdAt: -1 })
        .skip(skip).limit(Number(limit)),
      VisitorPass.countDocuments(query),
    ]);
    res.json({ success: true, data: { passes, total, page: Number(page), limit: Number(limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// SCAN QR — ENTRY or EXIT (security gate)
// ─────────────────────────────────────────────────────────────
export const scanVisitorQR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { passCode, action } = req.body; // action: 'entry' | 'exit'

    if (!passCode || !['entry', 'exit'].includes(action)) {
      res.status(400).json({ success: false, message: 'passCode and action (entry|exit) are required' });
      return;
    }

    const pass = await VisitorPass.findOne({ passCode })
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
        visitId: req.body.visitId || new (require('mongoose').Types.ObjectId)(),
        visitorId: req.body.visitorId || new (require('mongoose').Types.ObjectId)(),
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

    // Blacklist check
    if (visitor.isBlacklisted) {
      res.status(403).json({ success: false, message: 'Visitor is blacklisted', scanResult: 'denied', visitor });
      return;
    }

    // Revoked
    if (pass.status === 'revoked') {
      res.status(400).json({ success: false, message: 'Pass has been revoked', scanResult: 'revoked', visitor });
      return;
    }

    // Expired
    if (pass.status === 'expired' || new Date() > pass.validUntil) {
      pass.status = 'expired'; await pass.save();
      res.status(400).json({ success: false, message: 'Pass has expired', scanResult: 'expired', visitor });
      return;
    }

    // Visit must be approved or already checked-in (for exit)
    if (!['approved', 'checked-in'].includes(visit.status)) {
      res.status(400).json({ success: false, message: `Visit is ${visit.status}`, scanResult: 'invalid', visitor });
      return;
    }

    // Duplicate scan prevention
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

    // Perform action
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

    // Log
    await VisitorLog.create({
      visitId: visit._id, visitorId: visitor._id, passId: pass._id,
      action, timestamp: now,
      gateOperatorId: req.user!.userId, scanMethod: 'qr',
      ipAddress: getClientIp(req),
    });

    // Notify host on entry
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
      message: action === 'entry' ? 'Entry recorded ✓' : 'Exit recorded ✓',
      scanResult: 'success',
      data: { visitor, visit, action, timestamp: now },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// MANUAL LOOKUP by pass code
// ─────────────────────────────────────────────────────────────
export const lookupVisitorByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { passCode } = req.params;
    const pass = await VisitorPass.findOne({ passCode: passCode.toUpperCase() })
      .populate('visitorId', 'fullName phone email category photo')
      .populate({ path: 'visitId', populate: { path: 'hostId', select: 'name department' } });

    if (!pass) { res.status(404).json({ success: false, message: 'Pass not found' }); return; }
    res.json({ success: true, data: { pass } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// REVOKE PASS
// ─────────────────────────────────────────────────────────────
export const revokePass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { passId } = req.params;
    const { reason } = req.body;

    const pass = await VisitorPass.findById(passId).populate('visitorId', 'fullName');
    if (!pass) { res.status(404).json({ success: false, message: 'Pass not found' }); return; }
    if (['revoked', 'expired'].includes(pass.status)) {
      res.status(400).json({ success: false, message: `Pass is already ${pass.status}` }); return;
    }

    pass.status = 'revoked';
    pass.revokedBy = req.user!.userId as any;
    pass.revokedAt = new Date();
    pass.revocationReason = reason;
    await pass.save();

    // If visitor was inside, mark as checked-out
    const visit = await VisitorVisit.findById(pass.visitId);
    if (visit && visit.status === 'checked-in') {
      visit.status = 'checked-out';
      visit.checkedOutAt = new Date();
      await visit.save();
    }

    await createAuditLog(req.user!.userId, 'REVOKE_PASS', 'VisitorPass', passId, { reason }, getClientIp(req));

    res.json({ success: true, message: 'Pass revoked', data: { pass } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ENTRY & EXIT HISTORY
// ─────────────────────────────────────────────────────────────
export const getVisitorHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, action, page = 1, limit = 30 } = req.query;
    const query: any = {};

    if (action) query.action = action;
    if (date) {
      const d = new Date(date as string); d.setHours(0, 0, 0, 0);
      const nd = new Date(d); nd.setDate(nd.getDate() + 1);
      query.timestamp = { $gte: d, $lt: nd };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      VisitorLog.find(query)
        .populate('visitorId', 'fullName phone category')
        .populate('gateOperatorId', 'name role')
        .populate({ path: 'visitId', populate: { path: 'hostId', select: 'name department' } })
        .sort({ timestamp: -1 })
        .skip(skip).limit(Number(limit)),
      VisitorLog.countDocuments(query),
    ]);

    res.json({ success: true, data: { logs, total, page: Number(page), limit: Number(limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
      // Daily visitor count last 30 days
      VisitorVisit.aggregate([
        { $match: { visitDate: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$visitDate' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', count: 1, _id: 0 } },
      ]),
      // Category breakdown
      VisitorVisit.aggregate([
        { $lookup: { from: 'visitors', localField: 'visitorId', foreignField: '_id', as: 'visitor' } },
        { $unwind: '$visitor' },
        { $group: { _id: '$visitor.category', count: { $sum: 1 } } },
        { $project: { category: '$_id', count: 1, _id: 0 } },
      ]),
      // Department-wise visits
      VisitorVisit.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $project: { department: '$_id', count: 1, _id: 0 } },
      ]),
      // Status breakdown
      VisitorVisit.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } },
      ]),
      // This month total
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET SINGLE VISIT
// ─────────────────────────────────────────────────────────────
export const getVisitById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    const visit = await populateVisit(VisitorVisit.findById(visitId));
    if (!visit) { res.status(404).json({ success: false, message: 'Visit not found' }); return; }
    const pass = await VisitorPass.findOne({ visitId: visit._id });
    res.json({ success: true, data: { visit, pass } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const event = await VisitorEvent.findByIdAndUpdate(eventId, req.body, { new: true });
    if (!event) { res.status(404).json({ success: false, message: 'Event not found' }); return; }
    res.json({ success: true, data: { event } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    await VisitorEvent.findByIdAndUpdate(eventId, { isActive: false });
    res.json({ success: true, message: 'Event deactivated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET ALL VISITORS (directory)
// ─────────────────────────────────────────────────────────────
export const getVisitors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query: any = {};
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [visitors, total] = await Promise.all([
      Visitor.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Visitor.countDocuments(query),
    ]);
    res.json({ success: true, data: { visitors, total, page: Number(page), limit: Number(limit) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET HOSTS LIST (for registration form dropdown)
// ─────────────────────────────────────────────────────────────
export const getHosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hosts = await User.find({ role: { $in: ['teacher', 'admin'] }, isActive: true })
      .select('name email department role')
      .sort({ name: 1 });
    res.json({ success: true, data: { hosts } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// BLACKLIST / UN-BLACKLIST VISITOR
// ─────────────────────────────────────────────────────────────
export const toggleBlacklist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitorId } = req.params;
    const { blacklist, reason } = req.body;
    const visitor = await Visitor.findById(visitorId);
    if (!visitor) { res.status(404).json({ success: false, message: 'Visitor not found' }); return; }
    visitor.isBlacklisted = !!blacklist;
    visitor.blacklistReason = blacklist ? reason : undefined;
    await visitor.save();
    await createAuditLog(req.user!.userId, blacklist ? 'BLACKLIST_VISITOR' : 'UNBLACKLIST_VISITOR', 'Visitor', visitorId, { reason }, getClientIp(req));
    res.json({ success: true, message: `Visitor ${blacklist ? 'blacklisted' : 'removed from blacklist'}`, data: { visitor } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
