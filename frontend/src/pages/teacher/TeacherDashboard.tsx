import { useQuery } from '@tanstack/react-query'
import { BookOpen, Users, Activity, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatCard from '@/components/shared/StatCard'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState, { ChartEmpty } from '@/components/shared/ErrorState'
import { analyticsService } from '@/services/analytics.service'
import { teacherService } from '@/services/teacher.service'
import { useAuthStore } from '@/store/authStore'

export default function TeacherDashboard() {
  const { user } = useAuthStore()

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError, refetch } = useQuery({
    queryKey: ['teacher-analytics'],
    queryFn: analyticsService.getTeacherAnalytics,
  })

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['teacher-sessions-active'],
    queryFn: teacherService.getActiveSessions,
  })

  const statCards = [
    { title: 'My Subjects', value: analytics?.totalSubjects ?? 0, icon: BookOpen, color: 'blue' as const },
    { title: 'Total Sessions', value: analytics?.totalSessions ?? 0, icon: Activity, color: 'purple' as const },
    { title: 'Active Sessions', value: sessions?.length ?? 0, icon: Clock, color: 'green' as const },
    { title: 'Students Reached', value: analytics?.subjectStats?.reduce((a, s) => a + s.totalPresent, 0) ?? 0, icon: Users, color: 'amber' as const },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">Here's your teaching overview</p>
        </div>
        <Badge variant="success" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Online
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsError ? (
          <div className="col-span-4"><ErrorState message="Could not load analytics." onRetry={refetch} /></div>
        ) : analyticsLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card, i) => <StatCard key={card.title} {...card} index={i} />)
        }
      </div>

      {/* Attendance Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
            Attendance Trend (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="h-56 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
          ) : !analytics?.attendanceTrend?.length ? (
            <ChartEmpty label="No attendance data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics?.attendanceTrend || []}>
                <defs>
                  <linearGradient id="teacherGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="present" stroke="#7C3AED" strokeWidth={2} fill="url(#teacherGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Subject Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-4 h-4 text-primary" />
              Subject Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(analytics?.subjectStats || []).map((s) => (
                  <div key={s._id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{s.subjectName}</p>
                      <p className="text-xs text-muted-foreground">{s.subjectCode}</p>
                    </div>
                    <Badge variant="secondary">{s.totalPresent} present</Badge>
                  </div>
                ))}
                {!analytics?.subjectStats?.length && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No data yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-primary" />
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : sessions?.length ? (
              <div className="divide-y divide-border">
                {sessions.map((session) => (
                  <div key={session._id} className="py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {typeof session.subjectId === 'object' ? session.subjectId.subjectName : session.subjectId}
                      </p>
                      <Badge variant="success">Live</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Code: {session.sessionCode} · {session.totalPresent} present
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No active sessions</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
