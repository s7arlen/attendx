import { useQuery } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, Clock, TrendingUp, QrCode } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import StatCard from '@/components/shared/StatCard'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState, { ChartEmpty } from '@/components/shared/ErrorState'
import { analyticsService } from '@/services/analytics.service'
import { attendanceService } from '@/services/attendance.service'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

export default function StudentDashboard() {
  const { user } = useAuthStore()

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError, refetch } = useQuery({
    queryKey: ['student-analytics'],
    queryFn: analyticsService.getStudentAnalytics,
  })

  const { data: activeSessions } = useQuery({
    queryKey: ['student-active-sessions'],
    queryFn: attendanceService.getActiveSessions,
    refetchInterval: 20_000,
  })

  const navigate = useNavigate()

  const statCards = [
    { title: 'Total Present', value: analytics?.totalPresent ?? 0, icon: CheckCircle2, color: 'green' as const },
    { title: 'Subjects', value: analytics?.subjectBreakdown?.length ?? 0, icon: BookOpen, color: 'blue' as const },
    { title: 'This Month', value: analytics?.monthlyTrend?.at(-1)?.count ?? 0, icon: TrendingUp, color: 'purple' as const },
    { title: 'Recent Activity', value: analytics?.recentActivity?.length ?? 0, icon: Clock, color: 'amber' as const },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hi, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.rollNumber && <span className="mr-2">Roll: {user.rollNumber}</span>}
            {user?.department && <span>{user.department}</span>}
            {user?.year && <span> · Year {user.year}</span>}
            {user?.section && <span> · {user.section}</span>}
          </p>
        </div>
        <Badge variant="success" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Online
        </Badge>
      </div>

      {/* Active sessions banner — shows when teacher has a live session for student's subjects */}
      {activeSessions && activeSessions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Live Sessions — Mark Attendance Now
          </h3>
          {activeSessions.map((session: { _id: string; subjectId: { subjectName: string } | string; sessionCode: string }) => (
            <div key={session._id}
              className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5">
              <div>
                <p className="font-semibold text-sm">
                  {typeof session.subjectId === 'object' && session.subjectId !== null ? session.subjectId.subjectName : 'Session'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Code: <span className="font-mono font-bold">{session.sessionCode}</span>
                </p>
              </div>
              <Button variant="gradient" size="sm" className="gap-1.5" onClick={() => navigate('/student/scan')}>
                <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                Mark Attendance
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsError ? (
          <div className="col-span-4"><ErrorState message="Could not load analytics." onRetry={refetch} /></div>
        ) : analyticsLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card, i) => <StatCard key={card.title} {...card} index={i} />)
        }
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" aria-hidden="true" />
            Monthly Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="h-52 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
          ) : !analytics?.monthlyTrend?.length ? (
            <ChartEmpty label="No monthly data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={analytics?.monthlyTrend || []}>
                <defs>
                  <linearGradient id="studentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} fill="url(#studentGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Subject Breakdown & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-4 h-4 text-primary" />
              Subject Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse" />)}</div>
            ) : (
              <div className="divide-y divide-border">
                {(analytics?.subjectBreakdown || []).map((s) => (
                  <div key={s._id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{s.subjectName}</p>
                      <p className="text-xs text-muted-foreground">{s.subjectCode}</p>
                    </div>
                    <Badge variant="secondary">{s.present} present</Badge>
                  </div>
                ))}
                {!analytics?.subjectBreakdown?.length && (
                  <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse" />)}</div>
            ) : (
              <div className="divide-y divide-border">
                {(analytics?.recentActivity || []).slice(0, 6).map((r) => (
                  <div key={r._id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">
                        {typeof r.subjectId === 'object' ? r.subjectId.subjectName : 'Attendance'}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.timestamp)}</p>
                    </div>
                    <Badge variant={r.verificationStatus === 'verified' ? 'success' : 'secondary'}>
                      {r.verificationStatus}
                    </Badge>
                  </div>
                ))}
                {!analytics?.recentActivity?.length && (
                  <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
