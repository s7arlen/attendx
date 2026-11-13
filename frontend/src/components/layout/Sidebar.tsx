import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, BookOpen, Calendar, BarChart3, QrCode,
  History, ScanLine, ChevronLeft, ChevronRight, GraduationCap,
  ShieldCheck, LogOut, UserCheck, Clock, UserCircle,
  Shield, AlertTriangle, Building2, CalendarDays,
  UserPlus, ClipboardCheck, QrCode as QrCodeIcon, LogIn, BarChart2,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  label: string
  icon?: React.ElementType
  path?: string
  isHeader?: boolean
  group?: string
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard',  icon: LayoutDashboard, path: '/len-admin' },
  { label: 'Teachers',   icon: Users,            path: '/len-admin/teachers' },
  { label: 'Students',   icon: GraduationCap,    path: '/len-admin/students' },
  { label: 'Subjects',   icon: BookOpen,         path: '/len-admin/subjects' },
  { label: 'Timetable',  icon: Calendar,         path: '/len-admin/timetable' },
  { label: 'Analytics',  icon: BarChart3,        path: '/len-admin/analytics' },
  { label: 'Reports',    icon: History,          path: '/len-admin/reports' },
  { label: 'Disputes',   icon: AlertTriangle,    path: '/len-admin/disputes' },
  { label: 'Audit Logs', icon: Shield,           path: '/len-admin/audit-logs' },
  { label: 'Profile',    icon: UserCircle,       path: '/len-admin/profile' },
]

const visitorSubItems: NavItem[] = [
  { label: 'Visitor Dashboard',  icon: LayoutDashboard, path: '/visitor' },
  { label: 'All Visits',         icon: Users,           path: '/visitor/visits' },
  { label: 'Register Visitor',   icon: UserPlus,        path: '/visitor/register' },
  { label: 'Approvals',          icon: ClipboardCheck,  path: '/visitor/approvals' },
  { label: 'QR Passes',          icon: QrCodeIcon,      path: '/visitor/passes' },
  { label: 'Gate Scanner',       icon: ScanLine,        path: '/visitor/gate' },
  { label: 'Currently Inside',   icon: UserCheck,       path: '/visitor/inside' },
  { label: 'Entry/Exit History', icon: History,         path: '/visitor/history' },
  { label: 'Visitor Analytics',  icon: BarChart2,       path: '/visitor/analytics' },
  { label: 'Events',             icon: CalendarDays,    path: '/visitor/events' },
]

const teacherNavItems: NavItem[] = [
  { label: 'Dashboard',   icon: LayoutDashboard, path: '/teacher' },
  { label: 'My Subjects', icon: BookOpen,        path: '/teacher/subjects' },
  { label: 'Timetable',   icon: Clock,           path: '/teacher/timetable' },
  { label: 'Sessions',    icon: QrCode,          path: '/teacher/sessions' },
  { label: 'Analytics',   icon: BarChart3,       path: '/teacher/analytics' },
  // Visitor
  { label: 'VISITOR MANAGEMENT', isHeader: true },
  { label: 'My Requests',   icon: ClipboardCheck,  path: '/visitor/my-requests', group: 'visitor' },
  { label: 'Events',        icon: CalendarDays,    path: '/visitor/events',      group: 'visitor' },
  { label: 'Profile',   icon: UserCircle,      path: '/teacher/profile' },
]

const securityNavItems: NavItem[] = [
  { label: 'Gate Scanner',       icon: ScanLine,       path: '/visitor/gate' },
  { label: 'Register Visitor',   icon: UserPlus,       path: '/visitor/register' },
  { label: 'All Visits',         icon: Users,          path: '/visitor/visits' },
  { label: 'Currently Inside',   icon: UserCheck,      path: '/visitor/inside' },
  { label: 'QR Passes',          icon: QrCodeIcon,     path: '/visitor/passes' },
  { label: 'Entry/Exit History', icon: History,        path: '/visitor/history' },
  { label: 'Events',             icon: CalendarDays,   path: '/visitor/events' },
]

const studentNavItems: NavItem[] = [
  { label: 'Dashboard',   icon: LayoutDashboard, path: '/student' },
  { label: 'Scan QR',     icon: ScanLine,        path: '/student/scan' },
  { label: 'My Subjects', icon: BookOpen,        path: '/student/subjects' },
  { label: 'Attendance',  icon: UserCheck,       path: '/student/attendance' },
  { label: 'Analytics',   icon: BarChart3,       path: '/student/analytics' },
  { label: 'Profile',     icon: UserCircle,      path: '/student/profile' },
]

// Root paths — dashboard item should only be active on exact match
const dashboardPaths = new Set(['/len-admin', '/teacher', '/student'])

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const isVisitorRoute = location.pathname.startsWith('/visitor')
  const [visitorOpen, setVisitorOpen] = useState(isVisitorRoute)

  const navItems =
    user?.role === 'admin'    ? adminNavItems    :
    user?.role === 'teacher'  ? teacherNavItems  :
    user?.role === 'security' ? securityNavItems :
    studentNavItems

  return (
    // Wrapper — overflow-visible so the toggle button can poke outside
    <div className="relative h-full flex-shrink-0">
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="flex flex-col h-full bg-card border-r border-border overflow-hidden"
      >
        {/* ── Logo ── */}
        <div className={cn(
          'flex items-center h-16 border-b border-border flex-shrink-0 transition-all duration-250',
          collapsed ? 'px-0 justify-center' : 'px-4 gap-3'
        )}>
          <div className="flex-shrink-0 w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-md">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="logo-text"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col overflow-hidden whitespace-nowrap"
              >
                <span className="font-bold text-lg leading-tight tracking-tight text-foreground">AttendX</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            // Header item
            if (item.isHeader) {
              return !collapsed ? (
                <div key={item.label} className="pt-4 pb-1.5 px-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                </div>
              ) : <div key={item.label} className="pt-2 border-t border-border mx-2" />
            }
            if (!item.path || !item.icon) return null
            const Icon = item.icon
            const isActive =
              location.pathname === item.path ||
              (!dashboardPaths.has(item.path) && location.pathname.startsWith(item.path))

            return (
              <Link key={item.path} to={item.path} aria-current={isActive ? 'page' : undefined}>
                <div
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className={cn(
                    'w-5 h-5 flex-shrink-0',
                    isActive ? 'text-primary' : ''
                  )} aria-hidden="true" />

                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        key={`label-${item.path}`}
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-sm truncate overflow-hidden whitespace-nowrap flex-1"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {isActive && !collapsed && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  )}
                </div>
              </Link>
            )
          })}

          {/* ── Collapsible Visitor Management Section for Admin ── */}
          {user?.role === 'admin' && (
            <div className="pt-2">
              <div className="px-2 py-1">
                <div className="border-t border-border/60" />
              </div>

              <button
                type="button"
                onClick={() => setVisitorOpen(!visitorOpen)}
                title="Visitor Management"
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer text-muted-foreground hover:bg-accent hover:text-foreground',
                  isVisitorRoute && 'bg-primary/5 text-primary font-medium',
                  collapsed && 'justify-center px-0'
                )}
              >
                <Building2 className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                {!collapsed && (
                  <>
                    <span className="text-sm flex-1 text-left truncate">Visitor Desk</span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 transition-transform duration-200 opacity-60',
                        visitorOpen && 'transform rotate-180'
                      )}
                    />
                  </>
                )}
              </button>

              <AnimatePresence initial={false}>
                {!collapsed && visitorOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="pl-4 pr-1 space-y-0.5 pt-1 overflow-hidden"
                  >
                    {visitorSubItems.map((vItem) => {
                      const VIcon = vItem.icon!
                      const isVActive = location.pathname === vItem.path
                      return (
                        <Link key={vItem.path} to={vItem.path!}>
                          <div
                            className={cn(
                              'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer',
                              isVActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            )}
                          >
                            <VIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{vItem.label}</span>
                          </div>
                        </Link>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </nav>

        {/* ── Logout ── */}
        <div className={cn(
          'p-2 border-t border-border flex-shrink-0',
          collapsed && 'flex justify-center'
        )}>
          <button
            onClick={logout}
            title="Logout"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground',
              'hover:bg-red-500/10 hover:text-red-500 transition-all duration-150',
              collapsed ? 'justify-center px-0 w-10' : 'w-full'
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="logout-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-sm overflow-hidden whitespace-nowrap"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ── Toggle button — lives outside the overflow-hidden aside ── */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'absolute top-[72px] -right-3 z-20',
          'w-6 h-6 rounded-full',
          'bg-card border-2 border-border',
          'flex items-center justify-center',
          'shadow-md hover:shadow-lg',
          'hover:bg-primary hover:border-primary hover:text-white',
          'text-muted-foreground',
          'transition-all duration-150',
        )}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" />
          : <ChevronLeft className="w-3 h-3" />
        }
      </button>
    </div>
  )
}
