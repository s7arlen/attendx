import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Play, Square, Users, Clock, Hash, QrCode,
  X, RefreshCw, AlertCircle, FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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

const QR_REFRESH_INTERVAL = 20 // seconds

function LiveSessionModal({ session, onEnd, ending, onClose }: LiveSessionModalProps) {
  const [msLeft, setMsLeft] = useState(() => timeRemaining(session.expiryTime))
  const [qrCodeData, setQrCodeData] = useState(session.qrCodeData)
  const [qrSecondsLeft, setQrSecondsLeft] = useState(QR_REFRESH_INTERVAL)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Session countdown
  useEffect(() => {
    const tick = setInterval(() => {
      const remaining = timeRemaining(session.expiryTime)
      setMsLeft(remaining)
      if (remaining <= 0) clearInterval(tick)
    }, 1000)
    return () => clearInterval(tick)
  }, [session.expiryTime])

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const data = await attendanceService.refreshQR(session._id)
      setQrCodeData(data.qrCodeData)
      // qrToken update is handled server-side; session token stays current
    } catch {
      // Silently ignore — will retry next tick
    } finally {
      setIsRefreshing(false)
    }
  }, [session._id])

  // QR refresh countdown + auto-refresh every 20s
  useEffect(() => {
    if (msLeft <= 0) return
    const tick = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) { doRefresh(); return QR_REFRESH_INTERVAL }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [msLeft, session._id, doRefresh])

  // Live attendee count — socket push, fall back to poll
  const [socketPresent, setSocketPresent] = useState<number | null>(null)
  const socket = useSocket()

  useEffect(() => {
    socket.joinSession(session._id)
    const off = socket.onEvent('attendance:marked', (d: { totalPresent: number }) => {
      setSocketPresent(d.totalPresent)
    })
    return off
  // socket is a stable singleton — intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session._id])

  const { data: liveData } = useQuery({
    queryKey: ['live-session', session._id],
    queryFn: () => attendanceService.getLiveSession(session._id),
    refetchInterval: 5_000,
    enabled: msLeft > 0,
  })

  const totalPresent = socketPresent ?? liveData?.totalPresent ?? session.totalPresent
  const subjectName = typeof session.subjectId === 'object'
    ? session.subjectId.subjectName : 'Session'
  const subjectCode = typeof session.subjectId === 'object' && session.subjectId !== null
    ? (session.subjectId as { subjectCode?: string }).subjectCode || '' : ''

  const isExpired = msLeft <= 0
  const timerColor = msLeft < 60_000 ? 'text-red-500'
    : msLeft < 3 * 60_000 ? 'text-amber-500'
    : 'text-emerald-500'

  // SVG ring progress for QR refresh countdown

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <h2 className="font-bold text-lg leading-tight">{subjectName}</h2>
              <p className="text-xs text-muted-foreground font-mono">{subjectCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </Badge>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">

          {/* QR Code + refresh ring */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {/* Refresh countdown ring */}
              <svg
                className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] -rotate-90"
                viewBox="0 0 100 100"
                style={{ left: '-12px', top: '-12px' }}
              >
                <circle
                  cx="50" cy="50" r={46}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="2.5"
                />
                <circle
                  cx="50" cy="50" r={46}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: `${2 * Math.PI * 46}`,
                    strokeDashoffset: `${2 * Math.PI * 46 * (qrSecondsLeft / QR_REFRESH_INTERVAL)}`,
                    transition: 'stroke-dashoffset 1s linear',
                  }}
                />
              </svg>

              <div className="w-64 h-64 rounded-2xl overflow-hidden border-4 border-primary/20 shadow-lg bg-white p-2 relative">
                {qrCodeData ? (
                  <img
                    src={qrCodeData}
                    alt="Attendance QR Code"
                    className={`w-full h-full object-contain transition-opacity duration-300 ${isRefreshing ? 'opacity-30' : 'opacity-100'}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <QrCode className="w-20 h-20 text-muted-foreground/30" />
                  </div>
                )}
                {isRefreshing && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  </div>
                )}
                {isExpired && (
                  <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center">
                    <p className="text-white font-bold text-lg">Expired</p>
                  </div>
                )}
              </div>
            </div>

            {/* Refresh info + manual refresh */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3" />
              <span>Refreshes in <span className="font-mono font-semibold text-foreground">{qrSecondsLeft}s</span></span>
              <button
                onClick={() => { doRefresh(); setQrSecondsLeft(QR_REFRESH_INTERVAL) }}
                className="ml-1 text-primary hover:underline disabled:opacity-50"
                disabled={isRefreshing || isExpired}
              >
                Refresh now
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Students scan this QR code — it changes every {QR_REFRESH_INTERVAL}s
            </p>
          </div>

          {/* Session details */}
          <div className="flex flex-col gap-3">

            {/* Timer */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Time Remaining</p>
              <p className={`text-4xl font-mono font-bold ${timerColor}`}>
                {isExpired ? '0:00' : formatTimeRemaining(msLeft)}
              </p>
            </div>

            {/* Session Code */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Session Code</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-primary">
                {session.sessionCode}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Students enter this code manually</p>
            </div>

            {/* Password */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Verification Password
              </p>
              <p className="text-2xl font-mono font-bold tracking-widest">
                {session.passwordCode}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Enter after scanning QR</p>
            </div>

            {/* Attendee count */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPresent}</p>
                <p className="text-xs text-muted-foreground">students present</p>
              </div>
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground ml-auto animate-spin opacity-40" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 border-t border-border flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Expires at {new Date(session.expiryTime).toLocaleTimeString()}
          </p>
          <Button
            variant="destructive"
            className="gap-2"
            loading={ending}
            onClick={onEnd}
          >
            <Square className="w-4 h-4" />
            End Session
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherSessionsPage() {
  const queryClient = useQueryClient()
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedDuration, setSelectedDuration] = useState('15')
  const [subjectError, setSubjectError] = useState(false)
  const [liveSession, setLiveSession] = useState<AttendanceSession | null>(null)
  const [historyFilter, setHistoryFilter] = useState<string>('all') // 'all' | 'active' | 'ended' | 'expired'

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
    mutationFn: (data: { subjectId: string; duration: number }) =>
      attendanceService.startSession(data),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-sessions-active'] })
      toast({ title: 'Session started!', variant: 'success' })
      setStartDialogOpen(false)
      setSelectedSubject('')
      setSelectedDuration('15')
      setSubjectError(false)
      // Open QR modal with the full session data (includes qrCodeData + passwordCode)
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Start Attendance Session</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            A QR code will be shown for students to scan.
          </p>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="session-subject">Subject</Label>
              <Select
                value={selectedSubject}
                onValueChange={(v) => { setSelectedSubject(v); setSubjectError(false) }}
              >
                <SelectTrigger
                  id="session-subject"
                  className={subjectError ? 'border-destructive' : ''}
                  aria-describedby={subjectError ? 'subject-error' : undefined}
                >
                  <SelectValue placeholder="Select a subject…" />
                </SelectTrigger>
                <SelectContent>
                  {subjects?.length ? subjects.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.subjectName} ({s.subjectCode})
                    </SelectItem>
                  )) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No subjects assigned</div>
                  )}
                </SelectContent>
              </Select>
              {subjectError && (
                <p id="subject-error" role="alert" className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                  Please select a subject before starting
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-duration">
                Duration
                <span className="text-muted-foreground font-normal ml-1 text-xs">— how long the QR stays active</span>
              </Label>
              <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                <SelectTrigger id="session-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 30, 45, 60].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                startMutation.mutate({ subjectId: selectedSubject, duration: parseInt(selectedDuration) })
              }}
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              Start & Show QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
