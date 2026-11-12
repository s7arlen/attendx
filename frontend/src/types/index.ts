export type UserRole = 'admin' | 'teacher' | 'student' | 'security';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  year?: number;
  section?: string;
  rollNumber?: string;
  phone?: string;
  avatar?: string;
  isActive?: boolean;
  hasWebAuthn?: boolean;  // true when at least one biometric credential is registered
  createdAt?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Subject {
  _id: string;
  subjectName: string;
  subjectCode: string;
  assignedTeacher: User | string;
  department: string;
  year: number;
  section: string;
  credits: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Timetable {
  _id: string;
  subjectId: Subject | string;
  teacherId: User | string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  startTime: string;
  endTime: string;
  room?: string;
  isActive: boolean;
}

export type SessionStatus = 'active' | 'ended' | 'expired';

export interface AttendanceSession {
  _id: string;
  subjectId: Subject | string;
  teacherId: User | string;
  sessionCode: string;
  qrToken: string;
  qrCodeData: string;
  passwordCode: string;
  startTime: string;
  expiryTime: string;
  status: SessionStatus;
  duration: number;
  totalPresent: number;
  createdAt: string;
}

export type VerificationStatus = 'verified' | 'pending' | 'rejected';

export interface AttendanceRecord {
  _id: string;
  studentId: User | string;
  sessionId: AttendanceSession | string;
  subjectId: Subject | string;
  timestamp: string;
  verificationStatus: VerificationStatus;
  createdAt: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalSubjects: number;
  attendancePercentage: number;
  totalSessions: number;
}

export interface AdminAnalytics {
  overview: {
    totalStudents: number;
    totalTeachers: number;
    totalSubjects: number;
    totalSessions: number;
  };
  dailyAttendance: { date: string; count: number }[];
  subjectAttendance: { subjectName: string; subjectCode: string; count: number }[];
  monthlyAttendance: { month: string; count: number }[];
}

export interface StudentAnalytics {
  totalPresent: number;
  monthlyTrend: { month: string; count: number }[];
  subjectBreakdown: {
    _id: string;
    subjectName: string;
    subjectCode: string;
    present: number;
  }[];
  recentActivity: AttendanceRecord[];
}

export interface TeacherAnalytics {
  totalSubjects: number;
  totalSessions: number;
  subjects: Subject[];
  attendanceTrend: { date: string; present: number; subjectId: string }[];
  subjectStats: { _id: string; subjectName: string; subjectCode: string; totalPresent: number }[];
}

export interface QRPayload {
  sessionId: string;
  subjectId: string;
  timestamp: number;
  secureToken: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown[];
}

export interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

// ─── Visitor Management Types ────────────────────────────────

export type VisitorCategory = 'guest' | 'vendor' | 'parent' | 'official' | 'delivery' | 'interview' | 'contractor' | 'other';
export type VisitStatus = 'pending' | 'approved' | 'rejected' | 'checked-in' | 'checked-out' | 'expired' | 'cancelled';
export type PassStatus = 'active' | 'used-entry' | 'used-exit' | 'expired' | 'revoked';
export type LogAction = 'entry' | 'exit' | 'denied' | 'duplicate';

export interface Visitor {
  _id: string;
  fullName: string;
  phone: string;
  email?: string;
  category: VisitorCategory;
  photo?: string;
  nationalId?: string;
  address?: string;
  company?: string;
  notes?: string;
  isBlacklisted: boolean;
  blacklistReason?: string;
  createdAt: string;
}

export interface VisitorVisit {
  _id: string;
  visitorId: Visitor | string;
  hostId: User | string;
  registeredBy: User | string;
  visitType: 'pre-registered' | 'walk-in';
  purpose: string;
  department: string;
  visitDate: string;
  expectedArrival: string;
  expectedDeparture: string;
  accompanyingCount: number;
  status: VisitStatus;
  approvedBy?: User | string;
  approvedAt?: string;
  rejectedBy?: User | string;
  rejectedAt?: string;
  rejectionReason?: string;
  eventId?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  createdAt: string;
}

export interface VisitorPass {
  _id: string;
  visitId: VisitorVisit | string;
  visitorId: Visitor | string;
  passCode: string;
  qrCodeData: string;
  status: PassStatus;
  validFrom: string;
  validUntil: string;
  revokedBy?: User | string;
  revokedAt?: string;
  revocationReason?: string;
  createdAt: string;
}

export interface VisitorLog {
  _id: string;
  visitId: VisitorVisit | string;
  visitorId: Visitor | string;
  passId?: VisitorPass | string;
  action: LogAction;
  timestamp: string;
  gateOperatorId: User | string;
  scanMethod: 'qr' | 'manual';
  notes?: string;
  denied_reason?: string;
  createdAt: string;
}

export interface VisitorEvent {
  _id: string;
  name: string;
  description?: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  organizer: User | string;
  maxVisitors?: number;
  isActive: boolean;
  createdAt: string;
}

export interface VisitorDashboardStats {
  totalToday: number;
  pendingApprovals: number;
  currentlyInside: number;
  expectedToday: number;
  rejectedToday: number;
  totalVisitors: number;
  avgDuration: number;
  recentVisits: VisitorVisit[];
}

export interface VisitorAnalytics {
  dailyTrend: { date: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
  departmentStats: { department: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  totalThisMonth: number;
}
