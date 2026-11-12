import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, BookOpen, Calendar, BarChart3, QrCode,
  History, ScanLine, ChevronLeft, ChevronRight, GraduationCap,
  ShieldCheck, LogOut, UserCheck, Clock, UserCircle,
  Shield, AlertTriangle, Building2, CalendarDays,
  UserPlus, ClipboardCheck, QrCode as QrCodeIcon, LogIn, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  label: string
  icon: React.ElementType
  path: string
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
  // Visitor Management
  { label: '— Visitors —',       icon: Building2,      path: '/visitor',           group: 'visitor' },
  { label: 'Visitor Dashboard',   icon: LayoutDashboard, path: '/visitor',          group: 'visitor' },
  { label: 'All Visits',          icon: Users,           path: '/visitor/visits',   group: 'visitor' },
  { label: 'Register Visitor',    icon: UserPlus,        path: '/visitor/register', group: 'visitor' },
  { label: 'Approvals',           icon: ClipboardCheck,  path: '/visitor/approvals',group: 'visitor' },
  { label: 'QR Passes',           icon: QrCodeIcon,      path: '/visitor/passes',   group: 'visitor' },
  { label: 'Gate Scanner',        icon: ScanLine,        path: '/visitor/gate',     group: 'visitor' },
  { label: 'Currently Inside',    icon: UserCheck,       path: '/visitor/inside',   group: 'visitor' },
  { label: 'Entry/Exit History',  icon: History,         path: '/visitor/history',  group: 'visitor' },
  { label: 'Visitor Analytics',   icon: BarChart2,       path: '/visitor/analytics',group: 'visitor' },
  { label: 'Events',              icon: CalendarDays,    path: '/visitor/events',   group: 'visitor' },
  { label: 'Profile',    icon: UserCircle,       path: '/len-admin/profile' },
]

const teacherNavItems: NavItem[] = [
  { label: 'Dashboard',   icon: LayoutDashboard, path: '/teacher' },
  { label: 'My Subjects', icon: BookOpen,        path: '/teacher/subjects' },
  { label: 'Timetable',   icon: Clock,           path: '/teacher/timetable' },
  { label: 'Sessions',    icon: QrCode,          path: '/teacher/sessions' },
  { label: 'Analytics',   icon: BarChart3,       path: '/teacher/analytics' },
  // Visitor
  { label: '— Visitors —',  icon: Building2,       path: '/visitor',             group: 'visitor' },
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

const roleGradients: Record<string, string> = {
  admin:    'from-red-500 to-orange-500',
  teacher:  'from-blue-500 to-indigo-600',
  student:  'from-emerald-500 to-teal-600',
  security: 'from-slate-500 to-slate-700',
}

const roleIcons: Record<string, React.ElementType> = {
  admin:    ShieldCheck,
  teacher:  Users,
  student:  GraduationCap,
  security: Shield,
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const navItems =
    user?.role === 'admin'    ? adminNavItems    :
    user?.role === 'teacher'  ? teacherNavItems  :
    user?.role === 'security' ? securityNavItems :
    studentNavItems

  const RoleIcon = roleIcons[user?.role || 'student']
  const roleGradient = roleGradients[user?.role || 'student']

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
          <div className="flex-shrink-0 w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-lg">
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
                <span className="font-bold text-lg leading-tight gradient-text">AttendX</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  Scan · Verify · Attend
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── User badge ── */}
        <div className={cn(
          'border-b border-border flex-shrink-0 transition-all duration-250',
          collapsed ? 'px-0 py-3 flex justify-center' : 'px-3 py-3'
        )}>
          {collapsed ? (
            // Collapsed: just the role icon as a small circle
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br',
              roleGradient
            )}>
              <RoleIcon className="w-4 h-4 text-white" />
            </div>
          ) : (
            <motion.div
              key="user-badge"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'flex items-center gap-2.5 bg-gradient-to-r p-2.5 rounded-xl',
                roleGradient
              )}
            >
              <RoleIcon className="w-4 h-4 text-white flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-white/70 capitalize">{user?.role}</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            // Separator item
            if (item.label.startsWith('—')) {
              return !collapsed ? (
                <div key={item.path + '-sep'} className="pt-3 pb-1 px-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Visitor Management</p>
                </div>
              ) : <div key={item.path + '-sep'} className="pt-2 border-t border-border mx-2" />
            }
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
