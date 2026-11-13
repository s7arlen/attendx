import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import DashboardLayout from '@/components/layout/DashboardLayout'

// Auth Pages
import WelcomePage from '@/pages/auth/WelcomePage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import NotFoundPage from '@/pages/NotFoundPage'

// Admin Pages
import AdminDashboard from '@/pages/admin/AdminDashboard'
import TeachersPage from '@/pages/admin/TeachersPage'
import StudentsPage from '@/pages/admin/StudentsPage'
import SubjectsPage from '@/pages/admin/SubjectsPage'
import TimetablePage from '@/pages/admin/TimetablePage'
import AnalyticsPage from '@/pages/admin/AnalyticsPage'
import ReportsPage from '@/pages/admin/ReportsPage'
import AuditLogsPage from '@/pages/admin/AuditLogsPage'
import DisputesPage from '@/pages/admin/DisputesPage'
import AdminProfilePage from '@/pages/admin/AdminProfilePage'

// Teacher Pages
import TeacherDashboard from '@/pages/teacher/TeacherDashboard'
import TeacherSubjectsPage from '@/pages/teacher/TeacherSubjectsPage'
import TeacherTimetablePage from '@/pages/teacher/TeacherTimetablePage'
import TeacherSessionsPage from '@/pages/teacher/TeacherSessionsPage'
import TeacherSessionDetailPage from '@/pages/teacher/TeacherSessionDetailPage'
import TeacherSubjectAttendancePage from '@/pages/teacher/TeacherSubjectAttendancePage'
import TeacherAnalyticsPage from '@/pages/teacher/TeacherAnalyticsPage'
import TeacherProfilePage from '@/pages/teacher/TeacherProfilePage'

// Student Pages
import StudentDashboard from '@/pages/student/StudentDashboard'
import ScanQRPage from '@/pages/student/ScanQRPage'
import StudentSubjectsPage from '@/pages/student/StudentSubjectsPage'
import StudentAttendancePage from '@/pages/student/StudentAttendancePage'
import StudentAnalyticsPage from '@/pages/student/StudentAnalyticsPage'
import StudentProfilePage from '@/pages/student/StudentProfilePage'

// Visitor Pages
import VisitorDashboard from '@/pages/visitor/VisitorDashboard'
import AllVisitorsPage from '@/pages/visitor/AllVisitorsPage'
import RegisterVisitorPage from '@/pages/visitor/RegisterVisitorPage'
import VisitorApprovalsPage from '@/pages/visitor/VisitorApprovalsPage'
import VisitorPassesPage from '@/pages/visitor/VisitorPassesPage'
import SecurityGatePage from '@/pages/visitor/SecurityGatePage'
import CurrentlyInsidePage from '@/pages/visitor/CurrentlyInsidePage'
import VisitorHistoryPage from '@/pages/visitor/VisitorHistoryPage'
import VisitorAnalyticsPage from '@/pages/visitor/VisitorAnalyticsPage'
import EventManagementPage from '@/pages/visitor/EventManagementPage'
import VisitDetailPage from '@/pages/visitor/VisitDetailPage'
import VisitorRequestPage from '@/pages/visitor/VisitorRequestPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const home = user.role === 'admin' ? '/len-admin' : user.role === 'security' ? '/visitor/gate' : `/${user.role}`
    return <Navigate to={home} replace />
  }
  return <>{children}</>
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === 'admin') return <Navigate to="/len-admin" replace />
  if (user?.role === 'security') return <Navigate to="/visitor/gate" replace />
  return <Navigate to={`/${user?.role}`} replace />
}

function ThemeSync() {
  const { theme } = useThemeStore()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeSync />
        <Routes>
          {/* Public */}
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/visitor-request" element={<VisitorRequestPage />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Admin */}
          <Route path="/len-admin" element={<ProtectedRoute allowedRoles={['admin']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="teachers" element={<TeachersPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="timetable" element={<TimetablePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="disputes" element={<DisputesPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>

          {/* Teacher */}
          <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<TeacherDashboard />} />
            <Route path="subjects" element={<TeacherSubjectsPage />} />
            <Route path="subjects/:subjectId/attendance" element={<TeacherSubjectAttendancePage />} />
            <Route path="timetable" element={<TeacherTimetablePage />} />
            <Route path="sessions" element={<TeacherSessionsPage />} />
            <Route path="sessions/:sessionId" element={<TeacherSessionDetailPage />} />
            <Route path="analytics" element={<TeacherAnalyticsPage />} />
            <Route path="profile" element={<TeacherProfilePage />} />
          </Route>

          {/* Student */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<StudentDashboard />} />
            <Route path="scan" element={<ScanQRPage />} />
            <Route path="subjects" element={<StudentSubjectsPage />} />
            <Route path="attendance" element={<StudentAttendancePage />} />
            <Route path="analytics" element={<StudentAnalyticsPage />} />
            <Route path="profile" element={<StudentProfilePage />} />
          </Route>

          {/* Visitor Management — accessible by admin, security, teacher */}
          <Route path="/visitor" element={<ProtectedRoute allowedRoles={['admin','security','teacher']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<VisitorDashboard />} />
            <Route path="visits" element={<AllVisitorsPage />} />
            <Route path="visits/:visitId" element={<VisitDetailPage />} />
            <Route path="register" element={<RegisterVisitorPage />} />
            <Route path="approvals" element={<VisitorApprovalsPage />} />
            <Route path="my-requests" element={<VisitorApprovalsPage />} />
            <Route path="passes" element={<VisitorPassesPage />} />
            <Route path="gate" element={<SecurityGatePage />} />
            <Route path="inside" element={<CurrentlyInsidePage />} />
            <Route path="history" element={<VisitorHistoryPage />} />
            <Route path="analytics" element={<VisitorAnalyticsPage />} />
            <Route path="events" element={<EventManagementPage />} />
          </Route>

          {/* Block old /admin path */}
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="/admin/*" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
