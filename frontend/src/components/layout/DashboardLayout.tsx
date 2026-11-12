import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useThemeStore } from '@/store/themeStore'

const pageTitles: Record<string, string> = {
  '/len-admin':              'Admin Dashboard',
  '/len-admin/teachers':     'Manage Teachers',
  '/len-admin/students':     'Manage Students',
  '/len-admin/subjects':     'Manage Subjects',
  '/len-admin/timetable':    'Timetable',
  '/len-admin/analytics':    'Analytics',
  '/len-admin/reports':      'Reports',
  '/len-admin/audit-logs':   'Audit Logs',
  '/len-admin/disputes':     'Attendance Disputes',
  '/len-admin/profile':      'My Profile',
  '/teacher':                'Teacher Dashboard',
  '/teacher/subjects':       'My Subjects',
  '/teacher/timetable':      'My Timetable',
  '/teacher/sessions':       'Attendance Sessions',
  '/teacher/analytics':      'Analytics',
  '/teacher/profile':        'My Profile',
  '/student':                'Student Dashboard',
  '/student/scan':           'Mark Attendance',
  '/student/subjects':       'My Subjects',
  '/student/attendance':     'Attendance History',
  '/student/analytics':      'Analytics',
  '/student/profile':        'My Profile & Security',
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
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Desktop Sidebar — overflow-visible so toggle button pokes out ── */}
      <div className="hidden md:block flex-shrink-0 relative overflow-visible">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar
          onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          title={title}
        />
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="p-4 md:p-6 max-w-7xl mx-auto w-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
