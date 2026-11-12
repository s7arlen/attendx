import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Clock, AlertTriangle, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import ErrorState from '@/components/shared/ErrorState'
import { attendanceService } from '@/services/attendance.service'
import { studentService } from '@/services/student.service'
import { formatDate } from '@/lib/utils'
import { AttendanceRecord, ApiError } from '@/types'
import { toast } from '@/hooks/useToast'

export default function StudentAttendancePage() {
  const [page, setPage]                   = useState(1)
  const [subjectFilter, setSubjectFilter] = useState('')
  const [disputeRecord, setDisputeRecord] = useState<AttendanceRecord | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const queryClient = useQueryClient()
  const limit = 20

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['student-attendance-history', page, subjectFilter],
    queryFn: () => attendanceService.getAttendanceHistory({
      page, limit,
      subjectId: subjectFilter || undefined,
    }),
  })

  const { data: subjectsData } = useQuery({
    queryKey: ['student-subjects'],
    queryFn: studentService.getMySubjects,
  })

  const disputeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      attendanceService.raiseDispute(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-attendance-history'] })
      toast({ title: 'Dispute raised', description: 'Admin will review your record shortly.', variant: 'success' })
      setDisputeRecord(null)
      setDisputeReason('')
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Failed', description: error.response?.data?.message || 'Could not raise dispute.', variant: 'destructive' })
    },
  })

  const records: AttendanceRecord[] = data?.records || []
  const total: number = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  const statusIcon = (status: string) => {
    if (status === 'verified') return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" aria-hidden="true" />
    if (status === 'rejected')  return <XCircle className="w-4 h-4 text-destructive flex-shrink-0" aria-hidden="true" />
    return <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" aria-hidden="true" />
  }

  const statusVariant = (status: string) => {
    if (status === 'verified') return 'success' as const
    if (status === 'rejected') return 'error'   as const
    return 'secondary' as const
  }

  if (isError) return <ErrorState message="Could not load attendance history." onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Attendance History</h2>
        <p className="text-sm text-muted-foreground">{total} total records</p>
      </div>

      {/* Subject filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <Select
          value={subjectFilter}
          onValueChange={(v) => { setSubjectFilter(v === '_all' ? '' : v); setPage(1) }}
        >
          <SelectTrigger className="w-56" aria-label="Filter by subject">
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All subjects</SelectItem>
            {subjectsData?.map((s) => (
              <SelectItem key={s._id} value={s._id}>{s.subjectName} ({s.subjectCode})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {subjectFilter && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setSubjectFilter(''); setPage(1) }}
          >
            Clear filter
          </button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
            Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : records.length > 0 ? (
            <>
              <div className="divide-y divide-border" role="list" aria-label="Attendance records">
                {records.map((record) => (
                  <div key={record._id} className="flex items-center gap-3 py-3" role="listitem">
                    {statusIcon(record.verificationStatus)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {typeof record.subjectId === 'object' ? record.subjectId.subjectName : 'Subject'}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(record.timestamp)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={statusVariant(record.verificationStatus)}>
                        {record.verificationStatus}
                      </Badge>
                      {/* Dispute button — only for rejected records */}
                      {record.verificationStatus === 'rejected' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                          aria-label="Raise dispute for this record"
                          onClick={() => { setDisputeRecord(record); setDisputeReason('') }}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          Dispute
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} aria-label="Previous page"
                      onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} aria-label="Next page"
                      onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No attendance records yet</p>
          )}
        </CardContent>
      </Card>

      {/* Dispute dialog */}
      <Dialog open={!!disputeRecord} onOpenChange={(o) => { if (!o) setDisputeRecord(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Raise Attendance Dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="p-3 rounded-xl bg-muted/40 text-sm">
              <p className="font-medium">
                {disputeRecord && typeof disputeRecord.subjectId === 'object'
                  ? disputeRecord.subjectId.subjectName : 'Subject'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {disputeRecord && formatDate(disputeRecord.timestamp)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dispute-reason">Reason (optional)</Label>
              <Input
                id="dispute-reason"
                placeholder="e.g. I was present but not marked"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The admin will review your record and verify your attendance.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeRecord(null)}>Cancel</Button>
            <Button
              variant="gradient"
              loading={disputeMutation.isPending}
              onClick={() => disputeRecord && disputeMutation.mutate({ id: disputeRecord._id, reason: disputeReason })}
            >
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
