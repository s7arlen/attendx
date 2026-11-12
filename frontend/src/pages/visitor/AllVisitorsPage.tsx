import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Eye, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DataTable, { Column } from '@/components/shared/DataTable'
import ErrorState from '@/components/shared/ErrorState'
import { visitorService } from '@/services/visitor.service'
import { VisitorVisit } from '@/types'
import { formatDate } from '@/lib/utils'

const statusVariant: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  'approved': 'success', 'checked-in': 'success', 'checked-out': 'default',
  'pending': 'warning', 'rejected': 'error', 'expired': 'default', 'cancelled': 'default',
}

export default function AllVisitorsPage() {
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('')
  const [page, setPage]         = useState(1)
  const limit = 20

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['visitor-all-visits', search, status, page],
    queryFn: () => visitorService.getAllVisits({ search, status: status || undefined, page, limit }),
  })

  const columns: Column<VisitorVisit>[] = [
    {
      key: 'visitor', label: 'Visitor',
      render: (v) => {
        const visitor = v.visitorId as any
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
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
      render: (v) => <span className="text-xs text-muted-foreground">{formatDate(v.visitDate)}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <Badge variant={statusVariant[v.status] ?? 'default'}>{v.status.replace('-', ' ')}</Badge>,
    },
  ]

  if (isError) return <ErrorState message="Could not load visitor list." onRetry={refetch} />

  const visits = data?.visits || []
  const total  = data?.total  || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">All Visitors</h2>
          <p className="text-sm text-muted-foreground">{total} total records</p>
        </div>
        <Button variant="gradient" asChild>
          <Link to="/visitor/register">+ Register Visitor</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full h-10 rounded-xl border border-input bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search by name, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
        >
          <option value="">All Status</option>
          {['pending','approved','rejected','checked-in','checked-out','expired','cancelled'].map(s => (
            <option key={s} value={s}>{s.replace('-', ' ')}</option>
          ))}
        </select>
        {(search || status) && (
          <button
            onClick={() => { setSearch(''); setStatus(''); setPage(1) }}
            className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl"
          >
            Clear
          </button>
        )}
      </div>

      <DataTable
        data={visits.map((v: VisitorVisit) => ({ ...v, id: v._id }))}
        columns={columns}
        page={page}
        totalPages={Math.ceil(total / limit)}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No visitors found"
        caption="All visitor visits"
        actions={(visit) => (
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to={`/visitor/visits/${visit._id}`} aria-label="View details">
              <Eye className="w-4 h-4" />
            </Link>
          </Button>
        )}
      />
    </div>
  )
}
