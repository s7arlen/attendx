import { AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

/** Reusable error state for failed useQuery calls */
export default function ErrorState({ message = 'Failed to load data.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-destructive" aria-hidden="true" />
      </div>
      <div>
        <p className="font-medium text-sm">{message}</p>
        <p className="text-xs text-muted-foreground mt-1">Check your connection and try again.</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  )
}

/** Inline chart empty state — shows inside a chart card when data is empty */
export function ChartEmpty({ label = 'No data yet', sublabel }: { label?: string; sublabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[190px] gap-2 text-muted-foreground py-6">
      <div className="w-10 h-10 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-muted-foreground/50" aria-hidden="true" />
      </div>
      <p className="text-xs font-medium text-foreground/80">{label}</p>
      {sublabel && <p className="text-[11px] text-muted-foreground/70 max-w-xs text-center">{sublabel}</p>}
    </div>
  )
}
