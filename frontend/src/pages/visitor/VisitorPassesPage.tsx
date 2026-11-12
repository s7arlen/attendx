import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QrCode, ShieldOff, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import DataTable, { Column } from '@/components/shared/DataTable'
import ErrorState from '@/components/shared/ErrorState'
import { visitorService } from '@/services/visitor.service'
import { VisitorPass, ApiError } from '@/types'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

const passStatusVariant: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  'active': 'success', 'used-entry': 'success', 'used-exit': 'default',
  'expired': 'default', 'revoked': 'error',
}

export default function VisitorPassesPage() {
  const qc = useQueryClient()
  const [status, setStatus]       = useState('')
  const [page, setPage]           = useState(1)
  const [revokeTarget, setRevokeTarget] = useState<VisitorPass | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [previewPass, setPreviewPass]   = useState<VisitorPass | null>(null)
  const limit = 20

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['visitor-passes', status, page],
    queryFn: () => visitorService.getAllPasses({ status: status || undefined, page, limit }),
  })

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      visitorService.revokePass(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitor-passes'] })
      toast({ title: 'Pass revoked', variant: 'success' })
      setRevokeTarget(null); setRevokeReason('')
    },
    onError: (err) => {
      const error = err as ApiError
      toast({ title: 'Revoke failed', description: error.response?.data?.message, variant: 'destructive' })
    },
  })

  const columns: Column<VisitorPass>[] = [
    {
      key: 'passCode', label: 'Pass Code',
      render: (p) => (
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-primary" />
          <span className="font-mono font-semibold text-sm">{p.passCode}</span>
        </div>
      ),
    },
    {
      key: 'visitor', label: 'Visitor',
      render: (p) => {
        const visitor = p.visitorId as any
        return (
          <div>
            <p className="font-medium text-sm">{visitor?.fullName}</p>
            <p className="text-xs text-muted-foreground">{visitor?.phone}</p>
          </div>
        )
      },
    },
    {
      key: 'valid', label: 'Valid',
      render: (p) => (
        <div>
          <p className="text-xs">{formatDate(p.validFrom)}</p>
          <p className="text-xs text-muted-foreground">to {formatDate(p.validUntil)}</p>
        </div>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (p) => (
        <Badge variant={passStatusVariant[p.status] ?? 'default'}>{p.status.replace('-', ' ')}</Badge>
      ),
    },
  ]

  if (isError) return <ErrorState message="Could not load passes." onRetry={refetch} />

  const passes = data?.passes || []
  const total  = data?.total  || 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Visitor QR Passes</h2>
        <p className="text-sm text-muted-foreground">{total} total passes</p>
      </div>

      <div className="flex gap-3">
        <select
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
        >
          <option value="">All Status</option>
          {['active','used-entry','used-exit','expired','revoked'].map(s => (
            <option key={s} value={s}>{s.replace('-', ' ')}</option>
          ))}
        </select>
      </div>

      <DataTable
        data={passes.map((p: VisitorPass) => ({ ...p, id: p._id }))}
        columns={columns}
        page={page}
        totalPages={Math.ceil(total / limit)}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No passes found"
        caption="Visitor passes"
        actions={(pass) => (
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="icon-sm" onClick={() => setPreviewPass(pass)} aria-label="View QR">
              <Eye className="w-4 h-4" />
            </Button>
            {['active','used-entry'].includes(pass.status) && (
              <Button
                variant="ghost" size="icon-sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => { setRevokeTarget(pass); setRevokeReason('') }}
              >
                <ShieldOff className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      />

      {/* QR Preview dialog */}
      <Dialog open={!!previewPass} onOpenChange={() => setPreviewPass(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Visitor Pass</DialogTitle>
          </DialogHeader>
          {previewPass && (
            <div className="flex flex-col items-center gap-4">
              <img src={previewPass.qrCodeData} alt="Visitor QR" className="w-56 h-56 rounded-xl border" />
              <div className="text-center">
                <p className="font-mono font-bold text-xl tracking-widest">{previewPass.passCode}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Valid: {formatDate(previewPass.validFrom)} – {formatDate(previewPass.validUntil)}
                </p>
                <Badge variant={passStatusVariant[previewPass.status] ?? 'default'} className="mt-2">
                  {previewPass.status.replace('-', ' ')}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke Pass</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Revoking pass: <strong className="font-mono">{revokeTarget?.passCode}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder="Reason..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={revokeMutation.isPending}
              onClick={() => revokeTarget && revokeMutation.mutate({ id: revokeTarget._id, reason: revokeReason })}
            >
              Revoke Pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
