import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LogIn, LogOut, AlertCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import DataTable, { Column } from '@/components/shared/DataTable'
import ErrorState from '@/components/shared/ErrorState'
import { visitorService } from '@/services/visitor.service'
import { VisitorLog } from '@/types'
import { formatDate } from '@/lib/utils'

const actionIcon: Record<string, React.ReactNode> = {
  entry:     <LogIn className="w-3.5 h-3.5 text-emerald-500" />,
  exit:      <LogOut className="w-3.5 h-3.5 text-blue-500" />,
  denied:    <XCircle className="w-3.5 h-3.5 text-red-500" />,
  duplicate: <AlertCircle className="w-3.5 h-3.5 text-amber-500" />,
}

const actionVariant: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  entry: 'success', exit: 'default', denied: 'error', duplicate: 'warning',
}

export default function VisitorHistoryPage() {
  const [date, setDate]     = useState('')
  const [action, setAction] = useState('')
  const [page, setPage]     = useState(1)
  const limit = 30

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['visitor-history', date, action, page],
    queryFn: () => visitorService.getHistory({
      date: date || undefined,
      action: action || undefined,
      page, limit,
    }),
  })

  const columns: Column<VisitorLog>[] = [
    {
      key: 'action', label: 'Action',
      render: (log) => (
        <Badge variant={actionVariant[log.action] ?? 'default'} className="flex items-center gap-1 w-fit">
          {actionIcon[log.action]}
          {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'visitor', label: 'Visitor',
      render: (log) => {
        const visitor = log.visitorId as any
        return (
          <div>
            <p className="font-medium text-sm">{visitor?.fullName}</p>
            <p className="text-xs text-muted-foreground">{visitor?.phone}</p>
          </div>
        )
      },
    },
    {
      key: 'purpose', label: 'Purpose / Host',
      render: (log) => {
        const visit = log.visitId as any
        const host  = visit?.hostId as any
        return (
          <div>
            <p className="text-sm">{visit?.purpose}</p>
            <p className="text-xs text-muted-foreground">{host?.name} · {host?.department}</p>
          </div>
        )
      },
    },
    {
      key: 'operator', label: 'Gate Operator',
      render: (log) => {
        const op = log.gateOperatorId as any
        return (
          <div>
            <p className="text-sm">{op?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{op?.role}</p>
          </div>
        )
      },
    },
    {
      key: 'timestamp', label: 'Timestamp',
      render: (log) => (
        <div>
          <p className="text-xs">{formatDate(log.timestamp)}</p>
          <p className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</p>
        </div>
      ),
    },
    {
      key: 'scanMethod', label: 'Method',
      render: (log) => (
        <span className="text-xs text-muted-foreground capitalize">{log.scanMethod}</span>
      ),
    },
  ]

  if (isError) return <ErrorState message="Could not load history." onRetry={refetch} />

  const logs  = data?.logs  || []
  const total = data?.total || 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Entry & Exit History</h2>
        <p className="text-sm text-muted-foreground">{total} total log entries</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1) }}
        />
        <select
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}
        >
          <option value="">All Actions</option>
          <option value="entry">Entry</option>
          <option value="exit">Exit</option>
          <option value="denied">Denied</option>
          <option value="duplicate">Duplicate</option>
        </select>
        {(date || action) && (
          <button
            onClick={() => { setDate(''); setAction(''); setPage(1) }}
            className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl"
          >
            Clear
          </button>
        )}
      </div>

      <DataTable
        data={logs.map((l: VisitorLog) => ({ ...l, id: l._id }))}
        columns={columns}
        page={page}
        totalPages={Math.ceil(total / limit)}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No history found"
        caption="Entry and exit history"
      />
    </div>
  )
}
