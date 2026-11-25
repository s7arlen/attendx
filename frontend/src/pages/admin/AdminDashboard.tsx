import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users, GraduationCap, BookOpen, Percent, Activity,
  UserPlus, Download, Calendar, FileText, ArrowRight, Zap, MapPin,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import StatCard from '@/components/shared/StatCard'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState, { ChartEmpty } from '@/components/shared/ErrorState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { adminService } from '@/services/admin.service'
import { analyticsService } from '@/services/analytics.service'
import { motion } from 'framer-motion'
import api from '@/lib/axios'

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminService.getDashboardStats,
  })

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError, refetch: refetchAnalytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: analyticsService.getAdminAnalytics,
  })

  // Live sessions across institution
  const { data: liveData } = useQuery({
    queryKey: ['admin-live-sessions'],
    queryFn: async () => {
      const res = await api.get('/attendance/teacher/sessions')
      const all = res.data.data.sessions || []
      return all.filter((s: any) => s.status === 'active')
    },
    refetchInterval: 20_000,
  })
  const liveSessions: any[] = liveData || []

  const statCards = [
    { title: 'Total Students',  value: stats?.totalStudents ?? 0,              icon: GraduationCap, color: 'blue'   as const, index: 0 },
    { title: 'Total Teachers',  value: stats?.totalTeachers ?? 0,              icon: Users,         color: 'purple' as const, index: 1 },
    { title: 'Total Subjects',  value: stats?.totalSubjects ?? 0,              icon: BookOpen,      color: 'green'  as const, index: 2 },
    { title: 'Attendance Rate', value: `${stats?.attendancePercentage ?? 0}%`, icon: Percent,       color: 'amber'  as const, index: 3 },
  ]

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Institutional summary and real-time attendance metrics
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/len-admin/students">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9">
              <UserPlus className="w-3.5 h-3.5" />
              Add Student
            </Button>
          </Link>
          <Link to="/len-admin/reports">
            <Button size="sm" className="gap-1.5 text-xs h-9">
              <Download className="w-3.5 h-3.5" />
              Export Reports
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* ── KPI Stats ── */}
      {statsError ? (
        <ErrorState message="Could not load dashboard stats." onRetry={refetchStats} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : statCards.map((c) => <StatCard key={c.title} {...c} />)
          }
        </div>
      )}

      {/* ── Live Sessions Now ── */}
      {liveSessions.length > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              {liveSessions.length} session{liveSessions.length > 1 ? 's' : ''} live right now
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {liveSessions.map((s: any) => {
              const subjectName = typeof s.subjectId === 'object' ? s.subjectId?.subjectName : 'Session'
              const subjectCode = typeof s.subjectId === 'object' ? s.subjectId?.subjectCode : ''
              const typeEmoji: Record<string, string> = { class:'🎓', seminar:'🎤', workshop:'🛠️', event:'🎉', lab:'🧪' }
              return (
                <div key={s._id} className="bg-white dark:bg-card rounded-xl p-3 border border-emerald-200 dark:border-emerald-900/30 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{subjectName}</p>
                    <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                      <span>{subjectCode}</span>
                      {s.sessionType && <span>{typeEmoji[s.sessionType] || '📋'} {s.sessionType}</span>}
                      {s.venue && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{s.venue}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-emerald-600">{s.totalPresent}</p>
                    <p className="text-[10px] text-muted-foreground">present</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Charts ── */}
      {analyticsError ? (
        <ErrorState message="Could not load analytics." onRetry={refetchAnalytics} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Attendance Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
                  Daily Attendance (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="h-64 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
                ) : !analytics?.dailyAttendance?.length ? (
                  <ChartEmpty
                    label="No daily attendance sessions yet"
                    sublabel="Attendance logs will appear here once teachers start classroom sessions."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={analytics.dailyAttendance}>
                      <defs>
                        <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                      <Area type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} fill="url(#ag1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top Subjects by Attendance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <BookOpen className="w-4 h-4 text-primary" aria-hidden="true" />
                  Top Subjects by Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="h-64 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
                ) : !analytics?.subjectAttendance?.length ? (
                  <ChartEmpty
                    label="No subject attendance data yet"
                    sublabel="Breakdowns by course and subject will populate automatically."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={analytics.subjectAttendance.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="subjectCode" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                      <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Quick Administrative Shortcuts ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <Link
              to="/len-admin/subjects"
              className="p-4 rounded-xl border border-border bg-card/60 hover:bg-accent/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Manage Subjects</p>
                  <p className="text-xs text-muted-foreground">{stats?.totalSubjects ?? 12} active courses</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/len-admin/teachers"
              className="p-4 rounded-xl border border-border bg-card/60 hover:bg-accent/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Manage Faculty</p>
                  <p className="text-xs text-muted-foreground">{stats?.totalTeachers ?? 13} teachers</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/len-admin/students"
              className="p-4 rounded-xl border border-border bg-card/60 hover:bg-accent/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Manage Students</p>
                  <p className="text-xs text-muted-foreground">{stats?.totalStudents ?? 3} enrolled</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/len-admin/timetable"
              className="p-4 rounded-xl border border-border bg-card/60 hover:bg-accent/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Class Timetable</p>
                  <p className="text-xs text-muted-foreground">Schedules & rooms</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
