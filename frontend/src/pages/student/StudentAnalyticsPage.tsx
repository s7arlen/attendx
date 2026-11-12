import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, BookOpen, TrendingUp, Activity } from 'lucide-react'
import StatCard from '@/components/shared/StatCard'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState, { ChartEmpty } from '@/components/shared/ErrorState'
import { analyticsService } from '@/services/analytics.service'

const COLORS = ['#4F46E5', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']

export default function StudentAnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['student-analytics'],
    queryFn: analyticsService.getStudentAnalytics,
  })

  if (isError) return <ErrorState message="Could not load your analytics." onRetry={refetch} />

  const avgPerMonth = data?.monthlyTrend?.length
    ? Math.round(data.monthlyTrend.reduce((a, m) => a + m.count, 0) / data.monthlyTrend.length)
    : 0

  const statCards = [
    { title: 'Total Present', value: data?.totalPresent ?? 0,             icon: CheckCircle2, color: 'green'  as const },
    { title: 'Subjects',      value: data?.subjectBreakdown?.length ?? 0, icon: BookOpen,     color: 'blue'   as const },
    { title: 'This Month',    value: data?.monthlyTrend?.at(-1)?.count ?? 0, icon: Activity,  color: 'purple' as const },
    { title: 'Avg / Month',   value: avgPerMonth,                          icon: TrendingUp,  color: 'amber'  as const },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">My Analytics</h2>
        <p className="text-sm text-muted-foreground">Your personal attendance insights</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card, i) => <StatCard key={card.title} {...card} index={i} />)
        }
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" aria-hidden="true" />
            Monthly Attendance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-56 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
          ) : !data?.monthlyTrend?.length ? (
            <ChartEmpty label="No monthly data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.monthlyTrend}>
                <defs>
                  <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} fill="url(#sGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Subject Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-primary" aria-hidden="true" />
            Attendance by Subject
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-56 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
          ) : !data?.subjectBreakdown?.length ? (
            <ChartEmpty label="No subject data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.subjectBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subjectCode" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  formatter={(v, _, props) => [v, props.payload.subjectName]}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }}
                />
                <Bar dataKey="present" radius={[6, 6, 0, 0]}>
                  {data.subjectBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Per-subject summary list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
            Per-Subject Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.subjectBreakdown?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <div className="divide-y divide-border">
              {data.subjectBreakdown.map((s) => (
                <div key={s._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{s.subjectName}</p>
                    <p className="text-xs text-muted-foreground">{s.subjectCode}</p>
                  </div>
                  <Badge variant="secondary">{s.present} sessions</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
