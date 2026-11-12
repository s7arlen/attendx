import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { analyticsService } from '@/services/analytics.service'
import { TrendingUp, Users, BookOpen, Activity, GraduationCap } from 'lucide-react'
import StatCard from '@/components/shared/StatCard'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState, { ChartEmpty } from '@/components/shared/ErrorState'

const COLORS = ['#4F46E5', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#F97316']

export default function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: analyticsService.getAdminAnalytics,
  })

  if (isError) {
    return <ErrorState message="Could not load analytics." onRetry={refetch} />
  }

  const statCards = [
    { title: 'Total Students', value: data?.overview.totalStudents ?? 0, icon: GraduationCap, color: 'blue'   as const },
    { title: 'Total Teachers', value: data?.overview.totalTeachers ?? 0, icon: Users,         color: 'purple' as const },
    { title: 'Total Subjects', value: data?.overview.totalSubjects ?? 0, icon: BookOpen,      color: 'green'  as const },
    { title: 'Total Sessions', value: data?.overview.totalSessions ?? 0, icon: Activity,      color: 'amber'  as const },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Analytics Overview</h2>
        <p className="text-sm text-muted-foreground">Platform-wide attendance insights</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((c, i) => <StatCard key={c.title} {...c} index={i} />)
        }
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
              Daily Attendance (Last 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
            ) : !data?.dailyAttendance?.length ? (
              <ChartEmpty label="No daily data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data.dailyAttendance}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date"  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-primary" aria-hidden="true" />
              Monthly Attendance Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
            ) : !data?.monthlyAttendance?.length ? (
              <ChartEmpty label="No monthly data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data.monthlyAttendance}>
                  <defs>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} fill="url(#g2)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-4 h-4 text-primary" aria-hidden="true" />
              Subject-wise Attendance (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
            ) : !data?.subjectAttendance?.length ? (
              <ChartEmpty label="No subject data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.subjectAttendance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="subjectCode" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {data.subjectAttendance.map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4 text-primary" aria-hidden="true" />
              Subject Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
            ) : !data?.subjectAttendance?.slice(0, 6).length ? (
              <ChartEmpty label="No distribution data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.subjectAttendance.slice(0, 6)}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90}
                    paddingAngle={3}
                    dataKey="count" nameKey="subjectCode"
                  >
                    {data.subjectAttendance.slice(0, 6).map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
