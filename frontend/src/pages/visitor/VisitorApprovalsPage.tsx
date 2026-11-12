import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Eye, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import DataTable, { Column } from '@/components/shared/DataTable'
import ErrorState from '@/components/shared/ErrorState'
import { visitorService } from '@/services/visitor.service'
import { VisitorVisit, ApiError } from '@/types'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useAuthStore } from '@/store/authStore'

export default function VisitorApprovalsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [rejectTarget, setRejectTarget] = useState<VisitorVisit | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Admin sees all pending, teacher sees their own
  const queryFn = user?.role === 'admin'
    ? () => visitorService.getAllVisits({ status: 'pending' })
    : () => visitorService.getMyRequests({ status: 'pending' }).then(visits => ({ visits, total: visits.length, page: 1, limit: 50 }))

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['visitor-approvals', user?.role],
    queryFn,
  })

  const approveMutation = useMutation({
    mutationFn: (visitId: string) => visitorService.approveVisit(visitId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitor-approvals'] })
      qc.invalidateQueries({ queryKey: ['visitor-dashboard'] })
      toast({ title: 'Visit approved', description: 'QR pass generated and sent.', variant: 'success' })
    },
    onError: (err) => {
      const error = err as ApiError
      toast({ title: 'Approval failed', description: error.response?.data?.message, variant: 'destructive' })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => visitorService.rejectVisit(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitor-approvals'] })
      qc.invalidateQueries({ queryKey: ['visitor-dashboard'] })
      toast({ title: 'Visit rejected', variant: 'success' })
      setRejectTarget(null); setRejectReason('')
    },
    onError: (err) => {
      const error = err as ApiError
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' })
    },
  })

  const columns: Column<VisitorVisit>[] = [
    {
      key: 'visitor', label: 'Visitor',
      render: (v) => {
        const visitor = v.visitorId as any
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-xs font-bold text-amber-600 flex-shrink-0">
              {(visitor?.fullName || 'V').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-sm">{visitor?.fullName}</p>
              <p className="text-xs text-muted-foreground">{visitor?.phone}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'purpose', label: 'Purpose',
      render: (v) => <span className="text-sm">{v.purpose}</span>,
    },
    {
      key: 'host', label: 'Host',
      render: (v) => {
        const host = v.hostId as any
        return (
          <div>
            <p className="text-sm">{host?.name}</p>
            <p className="text-xs text-muted-foreground">{host?.department}</p>
          </div>
        )
      },
    },
    {
      key: 'visitDate', label: 'Visit Date',
      render: (v) => (
        <div>
          <p className="text-sm">{formatDate(v.visitDate)}</p>
          <p className="text-xs text-muted-foreground">{v.expectedArrival} – {v.expectedDeparture}</p>
        </div>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: () => (
        <Badge variant="warning" className="flex items-center gap-1 w-fit">
          <Clock className="w-3 h-3" /> Pending
        </Badge>
      ),
    },
  ]

  if (isError) return <ErrorState message="Could not load approvals." onRetry={refetch} />

  const visits = data?.visits || []
  const total  = data?.total  || 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Visitor Approvals</h2>
        <p className="text-sm text-muted-foreground">{total} pending approval{total !== 1 ? 's' : ''}</p>
      </div>

      <DataTable
        data={visits.map((v: VisitorVisit) => ({ ...v, id: v._id }))}
        columns={columns}
        loading={isLoading}
        emptyMessage="No pending approvals"
        caption="Pending visitor approvals"
        actions={(visit) => (
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link to={`/visitor/visits/${visit._id}`}><Eye className="w-4 h-4" /></Link>
            </Button>
            <Button
              variant="success" size="sm"
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate(visit._id)}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </Button>
            <Button
              variant="destructive" size="sm"
              onClick={() => { setRejectTarget(visit); setRejectReason('') }}
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </Button>
          </div>
        )}
      />

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Visit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Rejecting visit for: <strong>{(rejectTarget?.visitorId as any)?.fullName}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="State reason for rejection..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={rejectMutation.isPending}
              onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget._id, reason: rejectReason })}
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
