import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import ChatBot from '@/components/shared/ChatBot'
import { useThemeStore } from '@/store/themeStore'

const pageTitles: Record<string, string> = {
  '/len-admin':                 'Admin Dashboard',
  '/len-admin/teachers':        'Manage Teachers',
  '/len-admin/students':        'Manage Students',
  '/len-admin/subjects':        'Manage Subjects',
  '/len-admin/timetable':       'Timetable',
  '/len-admin/analytics':       'Analytics',
  '/len-admin/risk-analytics':  'Risk Analytics',
  '/len-admin/reports':         'Reports',
  '/len-admin/audit-logs':      'Audit Logs',
  '/len-admin/disputes':        'Attendance Disputes',
  '/len-admin/profile':         'My Profile',
  '/teacher':                   'Teacher Dashboard',
  '/teacher/subjects':          'My Subjects',
  '/teacher/smart-timetable':   'Auto Schedule',
  '/teacher/assessments':       'Assessments & Marks',
  '/teacher/risk':              'Early Warning Dashboard',
  '/teacher/interventions':     'Interventions',
  '/teacher/whatif':            'What-If Simulator',
  '/teacher/timetable':         'My Timetable',
  '/teacher/sessions':          'Attendance Sessions',
  '/teacher/analytics':         'Analytics',
  '/teacher/profile':           'My Profile',
  '/student':                   'Student Dashboard',
  '/student/scan':              'Mark Attendance',
  '/student/subjects':          'My Subjects',
  '/student/attendance':        'Attendance History',
  '/student/academic':          'Academic Profile',
  '/student/offline':           'Offline Attendance',
  '/student/analytics':         'Analytics',
  '/student/profile':           'My Profile & Security',
}

export default function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()
  const { theme } = useThemeStore()

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const title = pageTitles[location.pathname] || 'AttendX'

  return (
    <div className="flex h-screen bg-background overflow-hidden relative selection:bg-rose-500/20 selection:text-rose-600 dark:selection:text-rose-300">
      {/* ── Ambient Sunset Velvet Atmospheric Glows ── */}
      <div className="pointer-events-none fixed -top-48 -right-48 w-[500px] h-[500px] rounded-full bg-rose-500/10 dark:bg-rose-500/[0.08] blur-[120px] z-0" />
      <div className="pointer-events-none fixed top-1/3 -left-48 w-[450px] h-[450px] rounded-full bg-orange-500/10 dark:bg-orange-500/[0.05] blur-[120px] z-0" />
      <div className="pointer-events-none fixed -bottom-48 right-1/4 w-[500px] h-[500px] rounded-full bg-purple-600/10 dark:bg-purple-900/[0.12] blur-[130px] z-0" />

      {/* ── Desktop Sidebar ── */}
      <div className="hidden md:block flex-shrink-0 relative overflow-visible z-20">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full z-10">
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative z-10">
        <Navbar
          onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          title={title}
        />
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
      <ChatBot />
    </div>
  )
}
