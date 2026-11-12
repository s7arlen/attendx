import { useQuery } from '@tanstack/react-query'
import { Users, GraduationCap, BookOpen, TrendingUp, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import StatCard from '@/components/shared/StatCard'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState, { ChartEmpty } from '@/components/shared/ErrorState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminService } from '@/services/admin.service'
import { analyticsService } from '@/services/analytics.service'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export default function AdminDashboard() {
  const { user } = useAuthStore()

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminService.getDashboardStats,
  })

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError, refetch: refetchAnalytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: analyticsService.getAdminAnalytics,
  })

  const statCards = [
    { title: 'Total Students',  value: stats?.totalStudents ?? 0,         icon: GraduationCap, color: 'blue'   as const, index: 0 },
    { title: 'Total Teachers',  value: stats?.totalTeachers ?? 0,         icon: Users,         color: 'purple' as const, index: 1 },
    { title: 'Total Subjects',  value: stats?.totalSubjects ?? 0,         icon: BookOpen,      color: 'green'  as const, index: 2 },
    { title: 'Attendance Rate', value: `${stats?.attendancePercentage ?? 0}%`, icon: TrendingUp, color: 'amber' as const, index: 3 },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-muted-foreground mt-1 text-sm">Here's what's happening with AttendX today</p>
        </div>
        <Badge variant="success" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" aria-hidden="true" />
          System Online
        </Badge>
      </motion.div>

      {/* Stats */}
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

      {/* Charts */}
      {analyticsError ? (
        <ErrorState message="Could not load analytics." onRetry={refetchAnalytics} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
                  Daily Attendance (Last 30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="h-64 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
                ) : !analytics?.dailyAttendance?.length ? (
                  <ChartEmpty label="No daily attendance data yet" />
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="w-4 h-4 text-primary" aria-hidden="true" />
                  Top Subjects by Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="h-64 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
                ) : !analytics?.subjectAttendance?.length ? (
                  <ChartEmpty label="No subject attendance data yet" />
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-primary" aria-hidden="true" />
                Monthly Attendance Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className="h-48 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
              ) : !analytics?.monthlyAttendance?.length ? (
                <ChartEmpty label="No monthly data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={analytics.monthlyAttendance}>
                    <defs>
                      <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} fill="url(#ag2)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
