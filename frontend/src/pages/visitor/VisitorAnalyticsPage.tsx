import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, PieChart as PieIcon, BarChart2, Building2 } from 'lucide-react'
import { visitorService } from '@/services/visitor.service'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState, { ChartEmpty } from '@/components/shared/ErrorState'

const COLORS = ['#4F46E5','#7C3AED','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899','#F97316']

export default function VisitorAnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['visitor-analytics'],
    queryFn: visitorService.getAnalytics,
  })

  if (isError) return <ErrorState message="Could not load visitor analytics." onRetry={refetch} />

  const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Visitor Analytics</h2>
        <p className="text-sm text-muted-foreground">Platform-wide visitor insights</p>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Total This Month</p>
            {isLoading ? <div className="h-8 w-20 bg-muted rounded animate-pulse mt-1" /> : (
              <p className="text-3xl font-bold mt-1">{data?.totalThisMonth ?? 0}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" />
            Daily Visitor Trend (Last 30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-64 bg-muted/30 rounded-xl animate-pulse" /> :
           !data?.dailyTrend?.length ? <ChartEmpty label="No daily data yet" /> : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.dailyTrend}>
                <defs>
                  <linearGradient id="vg1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2} fill="url(#vg1)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieIcon className="w-4 h-4 text-primary" />
              Visitor Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-64 bg-muted/30 rounded-xl animate-pulse" /> :
             !data?.categoryBreakdown?.length ? <ChartEmpty label="No data" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.categoryBreakdown}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90}
                    paddingAngle={3}
                    dataKey="count" nameKey="category"
                  >
                    {data.categoryBreakdown.map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Department stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4 text-primary" />
              Department-wise Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-64 bg-muted/30 rounded-xl animate-pulse" /> :
             !data?.departmentStats?.length ? <ChartEmpty label="No data" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.departmentStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis type="category" dataKey="department" width={100} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {data.departmentStats.map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart2 className="w-4 h-4 text-primary" />
              Visit Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-64 bg-muted/30 rounded-xl animate-pulse" /> :
             !data?.statusBreakdown?.length ? <ChartEmpty label="No data" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.statusBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="status" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v.replace('-', ' ')} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, n.toString().replace('-', ' ')]} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {data.statusBreakdown.map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
