import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QrCode, RefreshCw, Save, ShieldCheck, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import ErrorState from '@/components/shared/ErrorState'
import { adminService } from '@/services/admin.service'
import { toast } from '@/hooks/useToast'
import { ApiError } from '@/types'

const PRESET_SECONDS = [10, 15, 20, 30, 60]
const MIN_SECONDS = 5
const MAX_SECONDS = 300

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const [secondsInput, setSecondsInput] = useState('15')
  const [applyToActive, setApplyToActive] = useState(true)

  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminService.getSettings,
  })

  useEffect(() => {
    if (settings?.qrRefreshSeconds) {
      setSecondsInput(String(settings.qrRefreshSeconds))
    }
  }, [settings?.qrRefreshSeconds])

  const minSec = settings?.minQrRefreshSeconds ?? MIN_SECONDS
  const maxSec = settings?.maxQrRefreshSeconds ?? MAX_SECONDS

  const parsedSeconds = Number(secondsInput)
  const isValid = Number.isInteger(parsedSeconds) && parsedSeconds >= minSec && parsedSeconds <= maxSec

  const saveMutation = useMutation({
    mutationFn: (payload: { qrRefreshSeconds: number; applyToActiveSessions: boolean }) =>
      adminService.updateSettings(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin-settings'], updated)
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      queryClient.invalidateQueries({ queryKey: ['admin-live-sessions'] })
      const activeCount = updated.updatedActiveSessions ?? 0
      toast({
        title: `QR refresh updated to ${updated.qrRefreshSeconds}s`,
        description: applyToActive && activeCount > 0
          ? `Applied to ${activeCount} active session${activeCount === 1 ? '' : 's'} immediately.`
          : 'New attendance sessions will use this refresh interval.',
        variant: 'success',
      })
    },
    onError: (err) => {
      const error = err as ApiError
      toast({
        title: 'Failed to save settings',
        description: error.response?.data?.message || 'Please check the refresh interval value.',
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) {
      toast({
        title: 'Invalid interval',
        description: `Enter a whole number between ${minSec} and ${maxSec} seconds.`,
        variant: 'destructive',
      })
      return
    }
    saveMutation.mutate({
      qrRefreshSeconds: parsedSeconds,
      applyToActiveSessions: applyToActive,
    })
  }

  if (isError) {
    return <ErrorState message="Could not load institution settings." onRetry={refetch} />
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure global QR rotation and attendance security defaults
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="w-4 h-4 text-primary" aria-hidden="true" />
                QR Code Auto-Refresh Interval
              </CardTitle>
              <CardDescription className="mt-1">
                Controls how often attendance QR tokens rotate on teacher screens and the public projector view.
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 font-mono">
              Current: {isLoading ? '…' : `${settings?.qrRefreshSeconds ?? 15}s`}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Quick presets */}
            <div className="space-y-2">
              <Label>Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_SECONDS.map((preset) => {
                  const selected = parsedSeconds === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSecondsInput(String(preset))}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        selected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {preset}s{preset === 15 ? ' (Default)' : ''}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom numeric input */}
            <div className="space-y-1.5">
              <Label htmlFor="qr-refresh-seconds">Custom Refresh Interval (seconds)</Label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Clock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="qr-refresh-seconds"
                    type="number"
                    min={minSec}
                    max={maxSec}
                    step={1}
                    value={secondsInput}
                    onChange={(e) => setSecondsInput(e.target.value)}
                    disabled={isLoading || saveMutation.isPending}
                    className="pl-9 font-mono"
                  />
                </div>
                <span className="text-sm text-muted-foreground">seconds ({minSec}–{maxSec}s)</span>
              </div>
              {!isValid && secondsInput !== '' && (
                <p role="alert" className="text-xs text-destructive">
                  Enter a whole number between {minSec} and {maxSec} seconds.
                </p>
              )}
            </div>

            {/* Apply to active sessions */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/70 bg-muted/20 cursor-pointer">
              <input
                type="checkbox"
                checked={applyToActive}
                onChange={(e) => setApplyToActive(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary rounded"
              />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-foreground">
                  Apply immediately to currently active sessions
                </p>
                <p className="text-muted-foreground">
                  Updates live teacher QR modals and projector screens on their next refresh cycle without ending active classes.
                </p>
              </div>
            </label>

            {/* Security behavior note */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                New scans always require the latest QR token. Students who already scanned a valid QR receive a 45-second handoff window to finish biometric or facial verification without being interrupted by rotation.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                {settings?.updatedAt
                  ? `Last updated ${new Date(settings.updatedAt).toLocaleString()}`
                  : 'Using default 15s interval'}
              </span>
              <Button
                type="submit"
                variant="gradient"
                loading={saveMutation.isPending}
                disabled={isLoading || !isValid}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
