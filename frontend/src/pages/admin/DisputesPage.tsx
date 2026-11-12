import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ErrorState from '@/components/shared/ErrorState'
import { adminService } from '@/services/admin.service'
import { formatDate, formatTime } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { ApiError } from '@/types'

export default function DisputesPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('pending')
  const queryClient = useQueryClient()
  const limit = 20

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['disputes', page, statusFilter],
    queryFn: () => adminService.getDisputes({ status: statusFilter, page, limit }),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'verified' | 'rejected' }) =>
      adminService.resolveDispute(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] })
      toast({ title: 'Record updated', variant: 'success' })
    },
    onError: (err) => {
      const error = err as ApiError
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' })
    },
  })

  const records = data?.records || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  if (isError) return <ErrorState message="Could not load disputes." onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Attendance Disputes</h2>
        <p className="text-sm text-muted-foreground">Review and resolve attendance records</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {['pending', 'verified', 'rejected'].map(s => (
          <button key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors ${
              statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}>
            {s}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-primary" aria-hidden="true" />
            Records ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" aria-hidden="true" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No {statusFilter} records
            </p>
          ) : (
            <>
              <div className="divide-y divide-border" role="list">
                {records.map((r: { _id: string; studentId?: { name: string; rollNumber: string }; subjectId?: { subjectName: string; subjectCode: string }; timestamp: string; verificationStatus: string }) => (
                  <div key={r._id} className="flex items-start gap-3 py-4" role="listitem">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{r.studentId?.name}</p>
                        <span className="text-xs text-muted-foreground font-mono">{r.studentId?.rollNumber}</span>
                        <Badge variant={
                          r.verificationStatus === 'verified' ? 'success' :
                          r.verificationStatus === 'rejected' ? 'error' : 'warning'
                        }>{r.verificationStatus}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {r.subjectId?.subjectName}{' '}
                        <span className="font-mono text-xs">({r.subjectId?.subjectCode})</span>
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {formatDate(r.timestamp)} at {formatTime(r.timestamp)}
                      </p>
                    </div>

                    {r.verificationStatus === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline"
                          className="gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                          loading={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate({ id: r._id, status: 'verified' })}>
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Verify
                        </Button>
                        <Button size="sm" variant="outline"
                          className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                          loading={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate({ id: r._id, status: 'rejected' })}>
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          Reject
                        </Button>
                      </div>
                    )}
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
