import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, BookOpen, Calendar, BarChart3, QrCode,
  History, ScanLine, ChevronLeft, ChevronRight, GraduationCap,
  LogOut, UserCheck, UserCircle, Shield, AlertTriangle, Building2,
  CalendarDays, UserPlus, ClipboardCheck, QrCode as QrCodeIcon,
  BarChart2, ChevronDown, Brain, Zap, WifiOff, Settings,
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
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/len-admin' },
  { label: 'Teachers',          icon: Users,           path: '/len-admin/teachers' },
  { label: 'Students',          icon: GraduationCap,   path: '/len-admin/students' },
  { label: 'Subjects',          icon: BookOpen,        path: '/len-admin/subjects' },
  { label: 'Timetable',         icon: Calendar,        path: '/len-admin/timetable' },
  { label: 'Risk Analytics',    icon: Brain,           path: '/len-admin/risk-analytics' },
  { label: 'Analytics',         icon: BarChart3,       path: '/len-admin/analytics' },
  { label: 'Reports',           icon: History,         path: '/len-admin/reports' },
  { label: 'Disputes',          icon: AlertTriangle,   path: '/len-admin/disputes' },
  { label: 'Audit Logs',        icon: Shield,          path: '/len-admin/audit-logs' },
  { label: 'Settings',          icon: Settings,        path: '/len-admin/settings' },
  { label: 'Profile',           icon: UserCircle,      path: '/len-admin/profile' },
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
  { label: 'Dashboard',          icon: LayoutDashboard, path: '/teacher' },
  { label: 'My Subjects',        icon: BookOpen,        path: '/teacher/subjects' },
  { label: 'My Timetable',       icon: Calendar,        path: '/teacher/timetable' },
  { label: 'Auto Schedule',      icon: Zap,             path: '/teacher/smart-timetable' },
  { label: 'Assessments',        icon: ClipboardCheck,  path: '/teacher/assessments' },
  { label: 'Early Warning',      icon: AlertTriangle,   path: '/teacher/risk' },
  { label: 'Interventions',      icon: Users,           path: '/teacher/interventions' },
  { label: 'What-If Sim',        icon: BarChart3,       path: '/teacher/whatif' },
  { label: 'Sessions',           icon: QrCode,          path: '/teacher/sessions' },
  { label: 'Analytics',          icon: BarChart2,       path: '/teacher/analytics' },
  { label: 'Visitor Management', isHeader: true },
  { label: 'My Requests',        icon: ClipboardCheck,  path: '/visitor/my-requests', group: 'visitor' },
  { label: 'Events',             icon: CalendarDays,    path: '/visitor/events',      group: 'visitor' },
  { label: 'Profile',            icon: UserCircle,      path: '/teacher/profile' },
]

const securityNavItems: NavItem[] = [
  { label: 'Gate Scanner',       icon: ScanLine,       path: '/visitor/gate' },
  { label: 'Register Visitor',   icon: UserPlus,       path: '/visitor/register' },
  { label: 'All Visits',         icon: Users,          path: '/visitor/visits' },
  { label: 'Currently Inside',   icon: UserCheck,      path: '/visitor/inside' },
  { label: 'QR Passes',          icon: QrCodeIcon,     path: '/visitor/passes' },
  { label: 'Entry/Exit History', icon: History,        path: '/visitor/history' },
  { label: 'Events',             icon: CalendarDays,   path: '/visitor/events' },
  { label: 'Profile',            icon: UserCircle,     path: '/visitor/profile' },
]

const studentNavItems: NavItem[] = [
  { label: 'Dashboard',          icon: LayoutDashboard, path: '/student' },
  { label: 'Scan QR',            icon: ScanLine,        path: '/student/scan' },
  { label: 'Offline Attendance', icon: WifiOff,         path: '/student/offline' },
  { label: 'My Subjects',        icon: BookOpen,        path: '/student/subjects' },
  { label: 'Attendance',         icon: UserCheck,       path: '/student/attendance' },
  { label: 'Academic Profile',   icon: GraduationCap,   path: '/student/academic' },
  { label: 'Analytics',          icon: BarChart3,       path: '/student/analytics' },
  { label: 'Profile',            icon: UserCircle,      path: '/student/profile' },
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
    <div className="relative h-full flex-shrink-0">
      <motion.aside
        animate={{ width: collapsed ? 74 : 264 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col h-full bg-white/80 dark:bg-[#130C1C]/85 backdrop-blur-2xl border-r border-white/60 dark:border-white/[0.08] overflow-hidden shadow-sm shadow-black/[0.02]"
      >
        {/* ── Brand Logo Header ── */}
        <div className={cn(
          'flex items-center h-16 border-b border-white/50 dark:border-white/[0.07] flex-shrink-0 transition-all',
          collapsed ? 'px-0 justify-center' : 'px-5 gap-3'
        )}>
          <div className="flex-shrink-0 w-9 h-9 rounded-xl gradient-sunset flex items-center justify-center shadow-md shadow-rose-950/25 ring-2 ring-rose-500/20">
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
                <span className="font-bold text-lg leading-tight tracking-tight text-foreground">
                  AttendX
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Navigation List ── */}
        <nav className="flex-1 py-4 space-y-1 px-2.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            if (item.isHeader) {
              return !collapsed ? (
                <div key={item.label} className="pt-4 pb-1.5 px-3">
                  <p className="text-[11px] font-semibold text-muted-foreground/80">{item.label}</p>
                </div>
              ) : <div key={item.label} className="pt-2 border-t border-border/40 mx-2" />
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
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-orange-500/5 text-rose-600 dark:text-rose-400 font-semibold border-l-2 border-rose-500 shadow-sm shadow-rose-950/5'
                      : 'text-muted-foreground hover:bg-rose-500/[0.06] hover:text-foreground'
                  )}
                >
                  <Icon className={cn(
                    'w-4 h-4 flex-shrink-0 transition-colors',
                    isActive ? 'text-rose-500 dark:text-rose-400' : 'group-hover:text-foreground'
                  )} aria-hidden="true" />

                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        key={`label-${item.path}`}
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-xs font-medium truncate overflow-hidden whitespace-nowrap flex-1"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {isActive && !collapsed && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full gradient-sunset flex-shrink-0 shadow-sm shadow-rose-500/50" />
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
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer text-muted-foreground hover:bg-rose-500/[0.06] hover:text-foreground',
                  isVisitorRoute && 'bg-rose-500/10 text-rose-500 font-medium',
                  collapsed && 'justify-center px-0'
                )}
              >
                <Building2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                {!collapsed && (
                  <>
                    <span className="text-xs flex-1 text-left truncate font-medium">Visitor Desk</span>
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 transition-transform duration-200 opacity-60',
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
                                ? 'bg-rose-500/10 text-rose-500 font-semibold'
                                : 'text-muted-foreground hover:bg-rose-500/[0.04] hover:text-foreground'
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

        {/* ── Legal Footer ── */}
        {!collapsed && (
          <div className="px-3 py-2 border-t border-white/50 dark:border-white/[0.07] flex items-center justify-center gap-2 text-[10px] text-muted-foreground/70 select-none">
            <Link to="/privacy" className="hover:text-rose-500 transition-colors">Privacy</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-rose-500 transition-colors">Terms</Link>
          </div>
        )}

        {/* ── Logout Button ── */}
        <div className={cn(
          'p-2.5 border-t border-white/50 dark:border-white/[0.07] flex-shrink-0',
          collapsed && 'flex justify-center'
        )}>
          <button
            onClick={logout}
            title="Logout"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-xl text-muted-foreground',
              'hover:bg-red-500/10 hover:text-red-500 transition-all duration-150',
              collapsed ? 'justify-center px-0 w-10 h-10' : 'w-full'
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="logout-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs font-semibold overflow-hidden whitespace-nowrap"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ── Floating Toggle Button ── */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'absolute top-[70px] -right-3 z-30',
          'w-6 h-6 rounded-full',
          'bg-white dark:bg-[#1C122A] border border-white/80 dark:border-white/20',
          'flex items-center justify-center',
          'shadow-md shadow-rose-950/20 hover:shadow-lg',
          'hover:bg-rose-500 hover:border-rose-500 hover:text-white',
          'text-muted-foreground',
          'transition-all duration-150 cursor-pointer',
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
