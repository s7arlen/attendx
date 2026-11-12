import { useQuery } from '@tanstack/react-query'
import {
  Users, Clock, CheckCircle2, AlertCircle, XCircle, Timer,
  UserCheck, CalendarDays, Building2, TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatCard from '@/components/shared/StatCard'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState from '@/components/shared/ErrorState'
import { visitorService } from '@/services/visitor.service'
import { VisitorVisit } from '@/types'
import { formatDate } from '@/lib/utils'

const visitStatusBadge = (status: string) => {
  const map: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
    'approved': 'success', 'checked-in': 'success', 'checked-out': 'default',
    'pending': 'warning', 'rejected': 'error', 'expired': 'default', 'cancelled': 'default',
  }
  return <Badge variant={map[status] ?? 'default'}>{status.replace('-', ' ')}</Badge>
}

export default function VisitorDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['visitor-dashboard'],
    queryFn: visitorService.getDashboard,
    refetchInterval: 30000,
  })

  if (isError) return <ErrorState message="Could not load visitor dashboard." onRetry={refetch} />

  const stats = [
    { title: 'Visitors Today',      value: data?.totalToday      ?? 0, icon: Users,        color: 'blue'   as const },
    { title: 'Currently Inside',    value: data?.currentlyInside ?? 0, icon: UserCheck,    color: 'green'  as const },
    { title: 'Pending Approvals',   value: data?.pendingApprovals ?? 0, icon: Clock,       color: 'amber'  as const },
    { title: 'Expected Today',      value: data?.expectedToday   ?? 0, icon: CalendarDays, color: 'purple' as const },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Visitor Dashboard</h2>
        <p className="text-sm text-muted-foreground">Real-time campus visitor overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : stats.map((s, i) => <StatCard key={s.title} {...s} index={i} />)
        }
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rejected Today</p>
              <p className="text-2xl font-bold">{data?.rejectedToday ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Timer className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Visit Duration</p>
              <p className="text-2xl font-bold">{data?.avgDuration ?? 0}<span className="text-sm font-normal ml-1 text-muted-foreground">min</span></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Visitors (All Time)</p>
              <p className="text-2xl font-bold">{data?.totalVisitors ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent visits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" />
            Recent Visitor Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : !data?.recentVisits?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No visits yet</p>
          ) : (
            <div className="space-y-2">
              {data.recentVisits.map((visit: VisitorVisit) => {
                const visitor = visit.visitorId as any
                const host = visit.hostId as any
                return (
                  <div key={visit._id} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {(visitor?.fullName || 'V').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{visitor?.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Meeting: {host?.name} · {host?.department}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {visitStatusBadge(visit.status)}
                      <span className="text-[10px] text-muted-foreground">{formatDate(visit.visitDate)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
