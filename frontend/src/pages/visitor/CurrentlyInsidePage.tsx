import { useQuery } from '@tanstack/react-query'
import { UserCheck, Phone, Building2, Clock, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ErrorState from '@/components/shared/ErrorState'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import { visitorService } from '@/services/visitor.service'
import { VisitorVisit } from '@/types'

export default function CurrentlyInsidePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['visitor-currently-inside'],
    queryFn: visitorService.getCurrentlyInside,
    refetchInterval: 15000, // auto-refresh every 15s
  })

  if (isError) return <ErrorState message="Could not load occupancy." onRetry={refetch} />

  const visits = data?.visits || []
  const total  = data?.total  || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-xl font-bold">Currently Inside Campus</h2>
          <p className="text-sm text-muted-foreground">Live occupancy view — auto-refreshes every 15 seconds</p>
        </div>
        <Badge variant="success" className="ml-auto flex items-center gap-1.5 text-sm px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {total} inside
        </Badge>
      </div>

      {/* Emergency banner if many visitors inside */}
      {total > 50 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/50">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
            High occupancy detected: {total} visitors currently on campus.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : visits.length === 0 ? (
        <div className="text-center py-16">
          <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No visitors currently inside campus</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visits.map((visit: VisitorVisit) => {
            const visitor = visit.visitorId as any
            const host    = visit.hostId    as any
            const checkedInAt = visit.checkedInAt ? new Date(visit.checkedInAt) : null
            const durationMin = checkedInAt ? Math.round((Date.now() - checkedInAt.getTime()) / 60000) : null

            return (
              <Card key={visit._id} className="border-emerald-200/60 dark:border-emerald-900/40">
                <CardContent className="pt-4 pb-4 space-y-3">
                  {/* Visitor info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center font-bold text-emerald-600 flex-shrink-0">
                      {(visitor?.fullName || 'V').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{visitor?.fullName}</p>
                      <Badge variant="default" className="text-[10px] mt-0.5 capitalize">{visitor?.category}</Badge>
                    </div>
                    <Badge variant="success" className="text-[10px] flex-shrink-0">Inside</Badge>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      {visitor?.phone}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      {host?.name} · {host?.department}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      {checkedInAt ? `Checked in: ${checkedInAt.toLocaleTimeString()}` : ''}
                      {durationMin !== null && durationMin >= 0 && (
                        <span className="ml-1 text-primary font-medium">({durationMin}m ago)</span>
                      )}
                    </div>
                  </div>

                  {/* Purpose */}
                  <p className="text-xs bg-muted/40 rounded-lg px-2 py-1.5 truncate">{visit.purpose}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
