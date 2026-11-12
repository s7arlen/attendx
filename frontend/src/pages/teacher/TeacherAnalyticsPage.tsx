import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, BookOpen, Users, TrendingUp } from 'lucide-react'
import StatCard from '@/components/shared/StatCard'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState, { ChartEmpty } from '@/components/shared/ErrorState'
import { analyticsService } from '@/services/analytics.service'

const COLORS = ['#4F46E5', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']

export default function TeacherAnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['teacher-analytics'],
    queryFn: analyticsService.getTeacherAnalytics,
  })

  if (isError) return <ErrorState message="Could not load analytics." onRetry={refetch} />

  const statCards = [
    { title: 'Total Subjects',  value: data?.totalSubjects ?? 0,                                                icon: BookOpen,  color: 'blue'   as const },
    { title: 'Total Sessions',  value: data?.totalSessions ?? 0,                                                icon: Activity,  color: 'purple' as const },
    { title: 'Total Present',   value: data?.subjectStats?.reduce((a, s) => a + s.totalPresent, 0) ?? 0,        icon: Users,     color: 'green'  as const },
    { title: 'Active Subjects', value: data?.subjects?.filter(s => s.isActive).length ?? 0,                     icon: TrendingUp, color: 'amber'  as const },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">My Analytics</h2>
        <p className="text-sm text-muted-foreground">Your teaching and attendance insights</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card, i) => <StatCard key={card.title} {...card} index={i} />)
        }
      </div>

      {/* Attendance Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
            Daily Attendance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-60 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
          ) : !data?.attendanceTrend?.length ? (
            <ChartEmpty label="No attendance trend data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.attendanceTrend}>
                <defs>
                  <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date"  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="present" stroke="#7C3AED" strokeWidth={2} fill="url(#tGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Subject Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-primary" aria-hidden="true" />
            Attendance by Subject
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-60 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
          ) : !data?.subjectStats?.length ? (
            <ChartEmpty label="No subject data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.subjectStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subjectCode" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                <Bar dataKey="totalPresent" radius={[6, 6, 0, 0]}>
                  {data.subjectStats.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
