import { useState, useEffect, useCallback, useRef, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Play, Users, Clock, QrCode, Hash,
  X, RefreshCw, AlertCircle, FileText,
  Maximize2, Minimize2, Copy, Check,
  ExternalLink, MapPin, Shield,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { attendanceService } from '@/services/attendance.service'
import { teacherService } from '@/services/teacher.service'
import { AttendanceSession, ApiError } from '@/types'
import { toast } from '@/hooks/useToast'
import { formatDate, formatTimeRemaining, timeRemaining } from '@/lib/utils'
import { useSocket } from '@/hooks/useSocket'

// ── Live QR Modal ─────────────────────────────────────────────────────────────
interface LiveSessionModalProps {
  session: AttendanceSession
  onEnd: () => void
  ending: boolean
  onClose: () => void
}

interface LiveRecordItem {
  _id?: string
  timestamp?: string
  createdAt?: string
  studentId?: { name?: string; rollNumber?: string; email?: string } | string
}

// QR refresh interval is configured per-session via Admin Settings (default 15s)
const DEFAULT_QR_REFRESH = 15

function LiveSessionModal({ session, onEnd, ending, onClose }: LiveSessionModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const [msLeft, setMsLeft] = useState(() => timeRemaining(session.expiryTime))
  const [qrCodeData, setQrCodeData] = useState(session.qrCodeData)
  const [dynamicCode, setDynamicCode] = useState(session.dynamicCode || '')
  const [socketRefreshSeconds, setSocketRefreshSeconds] = useState<number | null>(null)
  const initialQrInterval = session.qrRefreshSeconds ?? DEFAULT_QR_REFRESH
  const [qrSecondsLeft, setQrSecondsLeft] = useState(initialQrInterval)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isProjectorMode, setIsProjectorMode] = useState(false)
  const [showRoster, setShowRoster] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')

  // Live attendee count + QR sync — socket push, fall back to poll
  const [socketPresent, setSocketPresent] = useState<number | null>(null)
  const socket = useSocket()

  // Open native modal dialog & attach light-dismiss fallback for browsers without `closedby`
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) {
      dialog.showModal()
    }

    if ('closedBy' in HTMLDialogElement.prototype) return

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect()
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    }
    let pressedOutside = false
    const onDown = (e: PointerEvent) => { pressedOutside = isOutside(e) }
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e) && !isProjectorMode) {
        dialog.close()
      }
    }
    dialog.addEventListener('pointerdown', onDown)
    dialog.addEventListener('pointerup', onUp)
    return () => {
      dialog.removeEventListener('pointerdown', onDown)
      dialog.removeEventListener('pointerup', onUp)
    }
  }, [isProjectorMode])

  const { data: liveData } = useQuery({
    queryKey: ['live-session', session._id],
    queryFn: () => attendanceService.getLiveSession(session._id),
    refetchInterval: 5_000,
    enabled: msLeft > 0,
  })

  const qrInterval: number =
    liveData?.session?.qrRefreshSeconds ??
    socketRefreshSeconds ??
    session.qrRefreshSeconds ??
    DEFAULT_QR_REFRESH

  useEffect(() => {
    setQrSecondsLeft((prev: number) => (prev > qrInterval ? qrInterval : prev))
  }, [qrInterval])

  // Session countdown
  useEffect(() => {
    const tick = setInterval(() => {
      const remaining = timeRemaining(session.expiryTime)
      setMsLeft(remaining)
      if (remaining <= 0) clearInterval(tick)
    }, 1000)
    return () => clearInterval(tick)
  }, [session.expiryTime])

  useEffect(() => {
    if (liveData?.session?.dynamicCode) {
      setDynamicCode(liveData.session.dynamicCode)
    }
  }, [liveData?.session?.dynamicCode])

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const data = await attendanceService.refreshQR(session._id)
      setQrCodeData(data.qrCodeData)
      if (data.dynamicCode) {
        setDynamicCode(data.dynamicCode)
      }
      if (data.qrRefreshSeconds) {
        setSocketRefreshSeconds(data.qrRefreshSeconds)
      }
    } catch {
      // Silently ignore — will retry next tick
    } finally {
      setIsRefreshing(false)
    }
  }, [session._id])

  // QR refresh countdown + auto-refresh
  useEffect(() => {
    if (msLeft <= 0) return
    const tick = setInterval(() => {
      setQrSecondsLeft((prev: number) => {
        if (prev <= 1) { doRefresh(); return qrInterval }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [msLeft, session._id, doRefresh, qrInterval])

  useEffect(() => {
    socket.joinSession(session._id)
    const offMarked = socket.onEvent('attendance:marked', (d: { totalPresent: number }) => {
      setSocketPresent(d.totalPresent)
    })
    const offQr = socket.onEvent('qr:refreshed', (d: { qrCodeData?: string; dynamicCode?: string; qrRefreshSeconds?: number }) => {
      if (d.qrCodeData) setQrCodeData(d.qrCodeData)
      if (d.dynamicCode) setDynamicCode(d.dynamicCode)
      if (d.qrRefreshSeconds) setSocketRefreshSeconds(d.qrRefreshSeconds)
      setQrSecondsLeft(d.qrRefreshSeconds || qrInterval)
    })
    return () => {
      offMarked()
      offQr()
    }
  // socket is a stable singleton — intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session._id])

  const totalPresent: number = socketPresent ?? liveData?.totalPresent ?? session.totalPresent
  const absentCount: number = liveData?.absentCount ?? 0
  const capacity: number | null = session.capacity ?? null
  const sessionType: string = session.sessionType ?? 'class'
  const venue: string | null = session.venue ?? null
  const projectorSecret = liveData?.session?.projectorSecret || session.projectorSecret || ''
  const projectorUrl = `${window.location.origin}/projector/${session.sessionCode}${projectorSecret ? `?key=${encodeURIComponent(projectorSecret)}` : ''}`
  const subjectName = typeof session.subjectId === 'object'
    ? session.subjectId.subjectName : 'Session'
  const subjectCode = typeof session.subjectId === 'object' && session.subjectId !== null
    ? (session.subjectId as { subjectCode?: string }).subjectCode || '' : ''

  const isExpired = msLeft <= 0
  const endTimeLabel = new Date(session.expiryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const totalTarget = capacity ?? (totalPresent + absentCount > 0 ? totalPresent + absentCount : null)
  const progressPct = totalTarget ? Math.min(100, (totalPresent / totalTarget) * 100) : 0

  const handleCopy = (text: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
    }
    setCopiedCode(true)
    toast({ title: 'Copied to clipboard', description: text })
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const attendanceRecords = (liveData?.attendanceRecords as LiveRecordItem[]) || []
  const filteredRecords = attendanceRecords.filter((rec) => {
    if (!rosterSearch) return true
    const student = typeof rec.studentId === 'object' ? rec.studentId : null
    const name = student?.name || ''
    const roll = student?.rollNumber || student?.email || ''
    const query = rosterSearch.toLowerCase()
    return name.toLowerCase().includes(query) || roll.toLowerCase().includes(query)
  })

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onClose={onClose}
      onCancel={(e) => {
        if (isProjectorMode) {
          e.preventDefault()
          setIsProjectorMode(false)
        } else if (confirmEndOpen) {
          e.preventDefault()
          setConfirmEndOpen(false)
        }
      }}
      {...({ closedby: isProjectorMode ? 'closerequest' : 'any' } as Record<string, unknown>)}
      className={
        isProjectorMode
          ? 'm-0 max-w-none max-h-none w-screen h-screen bg-background text-foreground p-0 border-0 open:flex open:flex-col select-none'
          : 'm-auto w-[calc(100%-2rem)] max-w-[620px] bg-card text-foreground rounded-xl border border-border/80 shadow-xl p-0 overflow-hidden open:flex open:flex-col'
      }
    >
      {isProjectorMode ? (
        <div className="flex flex-col justify-between flex-1 p-8 sm:p-12 overflow-y-auto">
          <header className="flex items-start justify-between border-b border-border/60 pb-5 gap-6">
            <div>
              <h1 id={headingId} className="text-2xl sm:text-3xl font-semibold tracking-tight [text-wrap:balance]">
                {subjectName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {subjectCode} · {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}
                {venue && ` · ${venue}`}
              </p>
            </div>
            <div className="flex items-center gap-6 shrink-0">
              <div className="text-right">
                <span className={`text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums ${msLeft < 60_000 ? 'text-destructive' : ''}`}>
                  {isExpired ? '00:00' : formatTimeRemaining(msLeft)}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">Remaining</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsProjectorMode(false)}
                className="gap-1.5"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Exit
              </Button>
            </div>
          </header>

          <div className="my-auto py-10 flex flex-col lg:flex-row items-center justify-center gap-14 max-w-5xl mx-auto w-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-80 h-80 sm:w-96 sm:h-96 bg-white p-4 rounded-xl border border-border flex items-center justify-center relative">
                {qrCodeData ? (
                  <img
                    src={qrCodeData}
                    alt="Attendance QR Code"
                    className={`w-full h-full object-contain ${isRefreshing ? 'opacity-40' : 'opacity-100'}`}
                  />
                ) : (
                  <QrCode className="w-24 h-24 text-muted-foreground/30 animate-pulse" />
                )}
                {isRefreshing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                    <RefreshCw className="w-7 h-7 text-muted-foreground animate-spin" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">Rotates every {qrInterval}s</p>
            </div>

            <div className="space-y-6 max-w-sm w-full">
              <div>
                <p className="text-xs text-muted-foreground">Classroom code</p>
                <p className="font-mono text-4xl font-semibold tracking-[0.14em] tabular-nums mt-1 select-all">
                  {dynamicCode || '------'}
                </p>
              </div>
              <div className="pt-5 border-t border-border/60">
                <p className="text-2xl font-semibold tabular-nums">
                  {totalPresent}{totalTarget ? ` / ${totalTarget}` : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Checked in</p>
              </div>
            </div>
          </div>

          <footer className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
            <span className="tabular-nums">Ends {endTimeLabel}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEnd}
              loading={ending}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              End session
            </Button>
          </footer>
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border/60">
            <div className="min-w-0">
              <h1 id={headingId} className="text-base font-semibold leading-snug tracking-tight text-foreground [text-wrap:balance]">
                {subjectName}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                {subjectCode}{venue ? ` · ${venue}` : ''} · Ends {endTimeLabel}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsProjectorMode(true)}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                title="Full-screen classroom view"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Present</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => dialogRef.current?.close()}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Body */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-[224px_1fr] gap-7 items-center">
            {/* Left: QR */}
            <div className="flex flex-col items-center">
              <div className="w-full max-w-[224px] aspect-square bg-white p-2.5 rounded-lg border border-border/80 flex items-center justify-center relative">
                {qrCodeData ? (
                  <img
                    src={qrCodeData}
                    alt="Attendance QR Code"
                    className={`w-full h-full object-contain transition-opacity duration-200 ${isRefreshing ? 'opacity-40' : 'opacity-100'}`}
                  />
                ) : (
                  <QrCode className="w-14 h-14 text-muted-foreground/30 animate-pulse" />
                )}
                {isRefreshing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
                  </div>
                )}
                {isExpired && (
                  <div className="absolute inset-0 rounded-lg bg-background/85 backdrop-blur-xs flex items-center justify-center">
                    <span className="text-xs font-medium text-foreground">Session ended</span>
                  </div>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between w-full max-w-[224px] text-xs text-muted-foreground tabular-nums">
                <span>Refreshes in {qrSecondsLeft}s</span>
                <button
                  type="button"
                  onClick={() => { doRefresh(); setQrSecondsLeft(qrInterval) }}
                  disabled={isRefreshing || isExpired}
                  className="text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Right: Clean hierarchy without nested boxes */}
            <div className="min-w-0">
              {!showRoster ? (
                <div>
                  {/* Remaining clock */}
                  <div>
                    <div className={`text-4xl font-semibold tracking-tight tabular-nums leading-none ${
                      msLeft < 60_000 ? 'text-destructive' : 'text-foreground'
                    }`}>
                      {isExpired ? '00:00' : formatTimeRemaining(msLeft)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">Time remaining</p>
                  </div>

                  <div className="h-px bg-border/60 my-4" />

                  {/* Rotating classroom code */}
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Classroom code</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">Rotates every {qrInterval}s</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="font-mono text-2xl font-semibold tracking-[0.14em] tabular-nums text-foreground select-all">
                        {dynamicCode || '------'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(dynamicCode || session.sessionCode)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 shrink-0"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="h-px bg-border/60 my-4" />

                  {/* Attendance tally */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        {totalPresent}{totalTarget ? ` / ${totalTarget}` : ''} present
                      </span>
                      {attendanceRecords.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowRoster(true)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          View list
                        </button>
                      )}
                    </div>
                    {totalTarget !== null && (
                      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground/80 rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Present ({totalPresent})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRoster(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Back
                    </button>
                  </div>

                  {attendanceRecords.length > 4 && (
                    <input
                      type="text"
                      placeholder="Filter students…"
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  )}

                  <div className="max-h-52 overflow-y-auto divide-y divide-border/50 pr-1">
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((record, index) => {
                        const student = typeof record.studentId === 'object' ? record.studentId : null
                        const name = student?.name || `Student ${index + 1}`
                        const roll = student?.rollNumber || student?.email || ''
                        const time = new Date(record.timestamp || record.createdAt || Date.now()).toLocaleTimeString([], {
                          hour: '2-digit', minute: '2-digit',
                        })
                        return (
                          <div key={record._id || index} className="py-2 flex items-center justify-between text-xs gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono truncate">{roll}</p>
                            </div>
                            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{time}</span>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-6">No matching students</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="px-6 py-3 border-t border-border/60 flex items-center justify-between gap-3 bg-muted/20">
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(projectorUrl); window.open(projectorUrl, '_blank') }}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Projector view</span>
            </button>

            {confirmEndOpen ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">End session?</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmEndOpen(false)}
                  disabled={ending}
                  className="h-7 px-2 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  loading={ending}
                  onClick={onEnd}
                  className="h-7 px-2.5 text-xs"
                >
                  Confirm
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmEndOpen(true)}
                className="h-8 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
              >
                End session
              </Button>
            )}
          </footer>
        </>
      )}
    </dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherSessionsPage() {
  const queryClient = useQueryClient()
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedDuration, setSelectedDuration] = useState('15')
  const [sessionType, setSessionType] = useState('class')
  const [verificationMode, setVerificationMode] = useState('strict')
  const [capacity, setCapacity] = useState('')
  const [gracePeriod, setGracePeriod] = useState('0')
  const [venue, setVenue] = useState('')
  const [inviteList, setInviteList] = useState('')
  const [enableGeoFence, setEnableGeoFence] = useState(false)
  const [geoRadiusMeters, setGeoRadiusMeters] = useState('150')
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locatingGeo, setLocatingGeo] = useState(false)
  const [subjectError, setSubjectError] = useState(false)
  const [liveSession, setLiveSession] = useState<AttendanceSession | null>(null)
  const [historyFilter, setHistoryFilter] = useState<string>('all')

  const { data: subjects } = useQuery({
    queryKey: ['teacher-subjects'],
    queryFn: teacherService.getMySubjects,
  })

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['teacher-sessions'],
    queryFn: attendanceService.getTeacherSessions,
  })

  const { data: activeSessions } = useQuery({
    queryKey: ['teacher-sessions-active'],
    queryFn: teacherService.getActiveSessions,
    refetchInterval: 15_000,
  })

  const startMutation = useMutation({
    mutationFn: (data: Parameters<typeof attendanceService.startSession>[0]) =>
      attendanceService.startSession(data),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-sessions-active'] })
      toast({ title: 'Session started!', variant: 'success' })
      setStartDialogOpen(false)
      setSelectedSubject('')
      setSelectedDuration('15')
      setSessionType('class')
      setVerificationMode('strict')
      setCapacity('')
      setGracePeriod('0')
      setVenue('')
      setInviteList('')
      setEnableGeoFence(false)
      setGeoCoords(null)
      setSubjectError(false)
      setLiveSession(session)
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Error', description: error.response?.data?.message, variant: 'destructive' })
    },
  })

  const endMutation = useMutation({
    mutationFn: attendanceService.endSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-sessions-active'] })
      toast({ title: 'Session ended', variant: 'success' })
      setLiveSession(null)
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Error ending session', description: error.response?.data?.message, variant: 'destructive' })
    },
  })

  const openExistingSession = (session: AttendanceSession) => {
    setLiveSession(session)
  }

  const navigate = useNavigate()

  const statusVariant = (status: string) => {
    if (status === 'active') return 'success' as const
    if (status === 'ended') return 'secondary' as const
    return 'error' as const
  }

  return (
    <div className="space-y-6">

      {/* Live QR Modal */}
      {liveSession && (
        <LiveSessionModal
          session={liveSession}
          onEnd={() => endMutation.mutate(liveSession._id)}
          ending={endMutation.isPending}
          onClose={() => setLiveSession(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Sessions</h2>
          <p className="text-sm text-muted-foreground">Manage your attendance sessions</p>
        </div>
        <Button variant="gradient" onClick={() => setStartDialogOpen(true)} className="gap-2">
          <Play className="w-4 h-4" />
          Start Session
        </Button>
      </div>

      {/* Active Sessions */}
      {activeSessions && activeSessions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Live Sessions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessions.map((session) => (
              <Card
                key={session._id}
                className="border-emerald-200 dark:border-emerald-900/50 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openExistingSession(session)}
              >
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">
                        {typeof session.subjectId === 'object'
                          ? session.subjectId.subjectName
                          : session.subjectId}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3.5 h-3.5" />
                          {session.sessionCode}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {session.totalPresent} present
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="success">Live</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          openExistingSession(session)
                        }}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Show QR
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Session History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-primary" />
            Session History
          </CardTitle>
          {/* Status filter */}
          <div className="flex gap-1">
            {(['all', 'active', 'ended', 'expired'] as const).map(f => (
              <button key={f}
                onClick={() => setHistoryFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-lg capitalize font-medium transition-colors ${
                  historyFilter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sessions?.length ? (
            <div className="divide-y divide-border">
              {sessions
                .filter((s: AttendanceSession) => historyFilter === 'all' || s.status === historyFilter)
                .map((session: AttendanceSession) => (
                <div key={session._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {typeof session.subjectId === 'object'
                        ? session.subjectId.subjectName
                        : session.subjectId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(session.startTime)} · {session.totalPresent} students
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
                    {session.status === 'active' && (
                      <Button variant="ghost" size="sm" className="gap-1 text-xs"
                        onClick={() => openExistingSession(session)}>
                        <QrCode className="w-3.5 h-3.5" aria-hidden="true" />QR
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="gap-1 text-xs"
                      onClick={() => navigate(`/teacher/sessions/${session._id}`)}>
                      <FileText className="w-3.5 h-3.5" aria-hidden="true" />Report
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No sessions yet</p>
          )}
        </CardContent>
      </Card>

      {/* Start Session Dialog */}
      <Dialog open={startDialogOpen} onOpenChange={(o) => { setStartDialogOpen(o); if (!o) { setSubjectError(false) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Attendance Session</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            A QR code will be generated for students to scan.
          </p>
          <div className="space-y-3 pt-1 max-h-[65vh] overflow-y-auto pr-1">
            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="session-subject">Subject</Label>
              <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSubjectError(false) }}>
                <SelectTrigger id="session-subject" className={subjectError ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select a subject…" />
                </SelectTrigger>
                <SelectContent>
                  {subjects?.length ? subjects.map((s) => (
                    <SelectItem key={s._id} value={s._id}>{s.subjectName} ({s.subjectCode})</SelectItem>
                  )) : <div className="px-3 py-2 text-sm text-muted-foreground">No subjects assigned</div>}
                </SelectContent>
              </Select>
              {subjectError && (
                <p role="alert" className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Please select a subject
                </p>
              )}
            </div>

            {/* Session Type */}
            <div className="space-y-1.5">
              <Label>Session Type</Label>
              <Select value={sessionType} onValueChange={setSessionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">Class (Regular lecture)</SelectItem>
                  <SelectItem value="lab">Lab</SelectItem>
                  <SelectItem value="seminar">Seminar (Large crowd)</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="event">College Event</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" /> QR refreshes automatically per Admin Settings (15s default)
              </p>
            </div>

            {/* Verification Mode */}
            <div className="space-y-1.5">
              <Label>Verification Mode</Label>
              <Select value={verificationMode} onValueChange={setVerificationMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict">Strict (Enrolled students only)</SelectItem>
                  <SelectItem value="open">Open (Any registered user)</SelectItem>
                  <SelectItem value="invite">Invite-only (Specific roll numbers)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Invite list — shown only for invite mode */}
            {verificationMode === 'invite' && (
              <div className="space-y-1.5">
                <Label htmlFor="invite-list">
                  Invite List <span className="text-muted-foreground font-normal text-xs">— roll numbers, comma separated</span>
                </Label>
                <Input
                  id="invite-list"
                  placeholder="e.g. 4CB22CS001, 4CB22CS002"
                  value={inviteList}
                  onChange={(e) => setInviteList(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">Only these roll numbers can mark attendance.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Duration */}
              <div className="space-y-1.5">
                <Label htmlFor="session-duration">Duration</Label>
                <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                  <SelectTrigger id="session-duration"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grace Period */}
              <div className="space-y-1.5">
                <Label htmlFor="grace-period">Late Entry Grace</Label>
                <Select value={gracePeriod} onValueChange={setGracePeriod}>
                  <SelectTrigger id="grace-period"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None</SelectItem>
                    <SelectItem value="5">+5 min</SelectItem>
                    <SelectItem value="10">+10 min</SelectItem>
                    <SelectItem value="15">+15 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Capacity */}
              <div className="space-y-1.5">
                <Label htmlFor="capacity">Max Capacity <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>

              {/* Venue */}
              <div className="space-y-1.5">
                <Label htmlFor="venue">Venue <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="venue"
                  placeholder="e.g. Hall A, Room 301"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                />
              </div>
            </div>

            {/* Optional Classroom Geofencing */}
            <div className="rounded-xl border border-border/70 p-3 space-y-2.5 bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    Classroom Geofencing (optional)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Require students to be within radius of this room
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={enableGeoFence ? 'default' : 'outline'}
                  loading={locatingGeo}
                  onClick={() => {
                    if (enableGeoFence) {
                      setEnableGeoFence(false)
                      setGeoCoords(null)
                      return
                    }
                    if (!navigator.geolocation) {
                      toast({ title: 'Geolocation unsupported', variant: 'destructive' })
                      return
                    }
                    setLocatingGeo(true)
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setGeoCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
                        setEnableGeoFence(true)
                        setLocatingGeo(false)
                        toast({ title: 'Classroom location captured', variant: 'success' })
                      },
                      () => {
                        setLocatingGeo(false)
                        toast({ title: 'Location permission denied', description: 'Allow location access to lock classroom coordinates.', variant: 'destructive' })
                      },
                      { enableHighAccuracy: true, timeout: 8000 }
                    )
                  }}
                >
                  {enableGeoFence ? 'Enabled' : 'Set Location'}
                </Button>
              </div>
              {enableGeoFence && geoCoords && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                    Locked ({geoCoords.latitude.toFixed(4)}, {geoCoords.longitude.toFixed(4)})
                  </span>
                  <Select value={geoRadiusMeters} onValueChange={setGeoRadiusMeters}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[50, 100, 150, 300, 500].map((r) => (
                        <SelectItem key={r} value={String(r)}>{r}m radius</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setStartDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="gradient"
              className="flex-1 gap-2"
              loading={startMutation.isPending}
              onClick={() => {
                if (!selectedSubject) { setSubjectError(true); return }
                startMutation.mutate({
                  subjectId: selectedSubject,
                  duration: parseInt(selectedDuration),
                  sessionType,
                  verificationMode,
                  capacity: capacity ? parseInt(capacity) : null,
                  gracePeriodMinutes: parseInt(gracePeriod),
                  venue: venue || null,
                  inviteList: inviteList
                    ? inviteList.split(',').map(r => r.trim().toUpperCase()).filter(Boolean)
                    : [],
                  geoFence: enableGeoFence && geoCoords
                    ? { latitude: geoCoords.latitude, longitude: geoCoords.longitude, radiusMeters: parseInt(geoRadiusMeters) || 150 }
                    : null,
                })
              }}
            >
              <Play className="w-4 h-4" />
              Start & Show QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
