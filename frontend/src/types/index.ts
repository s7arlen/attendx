export type UserRole = 'admin' | 'teacher' | 'student';

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
