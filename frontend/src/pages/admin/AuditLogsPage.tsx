import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Search, User, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ErrorState from '@/components/shared/ErrorState'
import { adminService } from '@/services/admin.service'
import { formatDate, formatTime } from '@/lib/utils'

const actionColor = (action: string) => {
  if (action.startsWith('CREATE'))   return 'success'
  if (action.startsWith('DELETE') || action.startsWith('HARD')) return 'error'
  if (action.startsWith('LOGIN') || action.startsWith('REGISTER')) return 'blue'
  if (action.startsWith('DEACTIVATE')) return 'warning'
  return 'secondary'
}

export default function AuditLogsPage() {
  const [page, setPage]       = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const limit = 30

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', page, actionFilter],
    queryFn: () => adminService.getAuditLogs({ page, limit, action: actionFilter || undefined }),
  })

  const logs  = data?.logs  || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  if (isError) return <ErrorState message="Could not load audit logs." onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Audit Logs</h2>
          <p className="text-sm text-muted-foreground">{total} total events</p>
        </div>
      </div>

      {/* Filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <Input
          className="pl-10"
          placeholder="Filter by action…"
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1) }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-primary" aria-hidden="true" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" aria-hidden="true" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No audit logs found</p>
          ) : (
            <>
              <div className="divide-y divide-border" role="list">
                {logs.map((log: { _id: string; userId?: { name: string; email: string }; action: string; resource: string; resourceId?: string; ipAddress?: string; timestamp: string }) => (
                  <div key={log._id} className="flex items-start gap-3 py-3" role="listitem">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-primary" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {log.userId?.name || 'Unknown User'}
                        </p>
                        <span className="text-xs text-muted-foreground">{log.userId?.email}</span>
                        <Badge variant={actionColor(log.action) as "success" | "error" | "blue" | "warning" | "secondary"}>{log.action}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {log.resource}{log.resourceId ? ` · ${log.resourceId.slice(0, 8)}…` : ''}
                        {log.ipAddress ? ` · ${log.ipAddress}` : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {formatDate(log.timestamp)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatTime(log.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
