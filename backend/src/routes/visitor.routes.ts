import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getVisitorDashboard,
  registerVisitor,
  getAllVisits,
  getMyVisitorRequests,
  approveVisit,
  rejectVisit,
  getVisitorPass,
  getAllPasses,
  scanVisitorQR,
  lookupVisitorByCode,
  revokePass,
  getCurrentlyInside,
  getVisitorHistory,
  getVisitorAnalytics,
  getVisitById,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getVisitors,
  getHosts,
  toggleBlacklist,
  publicVisitorRequest,
  publicGetHosts,
} from '../controllers/visitor.controller';

const router = Router();

// ── PUBLIC routes (no auth) ───────────────────────────────────
router.get('/public/hosts', publicGetHosts);
router.post('/public/request', publicVisitorRequest);

// All other visitor routes require authentication
router.use(authenticate);

// ── Public (any authenticated user) ──────────────────────────
router.get('/hosts', getHosts);

// ── Admin + Security ──────────────────────────────────────────
router.get('/dashboard', authorize('admin', 'security'), getVisitorDashboard);
router.get('/visits', authorize('admin', 'security'), getAllVisits);
router.post('/register', authorize('admin', 'security'), registerVisitor);
router.get('/currently-inside', authorize('admin', 'security'), getCurrentlyInside);
router.get('/history', authorize('admin', 'security'), getVisitorHistory);
router.get('/analytics', authorize('admin'), getVisitorAnalytics);
router.get('/passes', authorize('admin', 'security'), getAllPasses);
router.get('/passes/lookup/:passCode', authorize('admin', 'security'), lookupVisitorByCode);
router.post('/scan', authorize('admin', 'security'), scanVisitorQR);
router.patch('/passes/:passId/revoke', authorize('admin'), revokePass);
router.get('/visitors', authorize('admin', 'security'), getVisitors);
router.patch('/visitors/:visitorId/blacklist', authorize('admin'), toggleBlacklist);

// ── Events (admin only) ───────────────────────────────────────
router.get('/events', authorize('admin', 'security', 'teacher'), getEvents);
router.post('/events', authorize('admin'), createEvent);
router.put('/events/:eventId', authorize('admin'), updateEvent);
router.delete('/events/:eventId', authorize('admin'), deleteEvent);

// ── Visit approval (host/teacher/admin) ───────────────────────
router.get('/my-requests', authorize('teacher', 'admin'), getMyVisitorRequests);
router.patch('/visits/:visitId/approve', authorize('admin', 'teacher'), approveVisit);
router.patch('/visits/:visitId/reject', authorize('admin', 'teacher'), rejectVisit);
router.get('/visits/:visitId', authorize('admin', 'security', 'teacher'), getVisitById);
router.get('/visits/:visitId/pass', authorize('admin', 'security', 'teacher'), getVisitorPass);

export default router;
