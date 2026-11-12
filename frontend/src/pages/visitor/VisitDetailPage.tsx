import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, User2, Phone, Mail, Building2, Calendar,
  Clock, QrCode, CheckCircle2, XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ErrorState from '@/components/shared/ErrorState'
import { visitorService } from '@/services/visitor.service'
import { formatDate } from '@/lib/utils'

const statusVariant: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  'approved': 'success', 'checked-in': 'success', 'checked-out': 'default',
  'pending': 'warning', 'rejected': 'error', 'expired': 'default', 'cancelled': 'default',
}

export default function VisitDetailPage() {
  const { visitId } = useParams<{ visitId: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['visit-detail', visitId],
    queryFn: () => visitorService.getVisitById(visitId!),
    enabled: !!visitId,
  })

  if (isLoading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 rounded-xl bg-muted/40 animate-pulse" />
      ))}
    </div>
  )
  if (isError) return <ErrorState message="Could not load visit details." onRetry={refetch} />

  const { visit, pass } = data!
  const visitor = visit.visitorId as any
  const host    = visit.hostId    as any

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-lg font-bold">Visit Details</h2>
          <p className="text-xs text-muted-foreground">#{visit._id.slice(-8).toUpperCase()}</p>
        </div>
        <Badge variant={statusVariant[visit.status] ?? 'default'} className="ml-auto capitalize">
          {visit.status.replace('-', ' ')}
        </Badge>
      </div>

      {/* Visitor info */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><User2 className="w-4 h-4 text-primary" />Visitor Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{visitor?.fullName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Category</p>
            <p className="font-medium capitalize">{visitor?.category}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <p>{visitor?.phone}</p>
          </div>
          {visitor?.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <p>{visitor.email}</p>
            </div>
          )}
          {visitor?.company && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Company</p>
              <p>{visitor.company}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visit details */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />Visit Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Purpose</p>
            <p className="font-medium">{visit.purpose}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Host</p>
            <p className="font-medium">{host?.name}</p>
            <p className="text-xs text-muted-foreground">{host?.department}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Department</p>
            <p>{visit.department}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <p>{formatDate(visit.visitDate)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <p>{visit.expectedArrival} – {visit.expectedDeparture}</p>
          </div>
          {visit.accompanyingCount > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Accompanying</p>
              <p>{visit.accompanyingCount} person(s)</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <Badge variant="default" className="capitalize">{visit.visitType.replace('-', ' ')}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Approval info */}
      {(visit.approvedBy || visit.rejectedBy) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Approval Status</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {visit.status === 'approved' || visit.status === 'checked-in' || visit.status === 'checked-out' ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Approved by {(visit.approvedBy as any)?.name} on {visit.approvedAt ? formatDate(visit.approvedAt) : '—'}</span>
              </div>
            ) : visit.status === 'rejected' ? (
              <div className="flex items-start gap-2 text-red-500">
                <XCircle className="w-4 h-4 mt-0.5" />
                <div>
                  <p>Rejected by {(visit.rejectedBy as any)?.name}</p>
                  {visit.rejectionReason && <p className="text-xs text-muted-foreground">{visit.rejectionReason}</p>}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* QR Pass */}
      {pass && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><QrCode className="w-4 h-4 text-primary" />Visitor Pass</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <img src={pass.qrCodeData} alt="Visitor QR Pass" className="w-48 h-48 rounded-xl border" />
            <div className="text-center">
              <p className="font-mono font-bold text-2xl tracking-widest">{pass.passCode}</p>
              <p className="text-xs text-muted-foreground mt-1">Valid: {formatDate(pass.validFrom)} – {formatDate(pass.validUntil)}</p>
              <Badge variant={pass.status === 'active' ? 'success' : 'default'} className="mt-2 capitalize">
                {pass.status.replace('-', ' ')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check-in/out times */}
      {(visit.checkedInAt || visit.checkedOutAt) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Gate Record</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {visit.checkedInAt && (
              <div>
                <p className="text-xs text-muted-foreground">Checked In</p>
                <p className="font-medium text-emerald-600">{new Date(visit.checkedInAt).toLocaleString()}</p>
              </div>
            )}
            {visit.checkedOutAt && (
              <div>
                <p className="text-xs text-muted-foreground">Checked Out</p>
                <p className="font-medium text-blue-600">{new Date(visit.checkedOutAt).toLocaleString()}</p>
              </div>
            )}
            {visit.checkedInAt && visit.checkedOutAt && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium">
                  {Math.round((new Date(visit.checkedOutAt).getTime() - new Date(visit.checkedInAt).getTime()) / 60000)} minutes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
