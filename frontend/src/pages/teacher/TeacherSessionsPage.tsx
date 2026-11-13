import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Play, Users, Clock, QrCode, Hash,
  X, RefreshCw, AlertCircle, FileText,
  Maximize2, Minimize2, Copy, Check,
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
  const [isProjectorMode, setIsProjectorMode] = useState(false)
  const [showRoster, setShowRoster] = useState(false)
  const [copiedField, setCopiedField] = useState<'sessionCode' | 'passwordCode' | null>(null)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')

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

  // Escape key handler for Projector Mode & dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmEndOpen) {
          setConfirmEndOpen(false)
        } else if (isProjectorMode) {
          setIsProjectorMode(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isProjectorMode, confirmEndOpen, onClose])

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
  const sessionDurationMinutes = session.duration || 15

  const handleCopy = (text: string, field: 'sessionCode' | 'passwordCode') => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
    }
    setCopiedField(field)
    toast({ title: 'Copied to clipboard', description: text })
    setTimeout(() => setCopiedField(null), 2000)
  }

  const attendanceRecords = (liveData?.attendanceRecords as any[]) || []
  const filteredRecords = attendanceRecords.filter((rec: any) => {
    if (!rosterSearch) return true
    const student = typeof rec.studentId === 'object' ? rec.studentId : null
    const name = student?.name || ''
    const roll = student?.rollNumber || student?.email || ''
    const query = rosterSearch.toLowerCase()
    return name.toLowerCase().includes(query) || roll.toLowerCase().includes(query)
  })

  // ── Projector View ─────────────────────────────────────────────────────────
  if (isProjectorMode) {
    return (
      <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col justify-between p-8 sm:p-12 select-none overflow-y-auto overscroll-contain">
        {/* Top */}
        <div className="flex items-center justify-between border-b border-border/60 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{subjectName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{subjectCode} · Attendance Session</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className={`text-3xl sm:text-4xl font-mono font-semibold tracking-tight ${msLeft < 60_000 ? 'text-destructive' : ''}`}>
                {isExpired ? '00:00' : formatTimeRemaining(msLeft)}
              </span>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsProjectorMode(false)}
              className="gap-1.5"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Exit (Esc)
            </Button>
          </div>
        </div>

        {/* Center */}
        <div className="my-auto py-10 flex flex-col lg:flex-row items-center justify-center gap-14 max-w-5xl mx-auto w-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-80 h-80 sm:w-96 sm:h-96 bg-white p-4 rounded-2xl border border-border shadow-lg flex items-center justify-center relative">
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
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-2xl">
                  <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Refreshes every {QR_REFRESH_INTERVAL}s</p>
          </div>

          <div className="space-y-6 max-w-sm w-full">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Session Code</p>
              <p className="font-mono text-3xl font-bold tracking-wider select-all">{session.sessionCode}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Passcode</p>
              <p className="font-mono text-3xl font-bold tracking-wider select-all">{session.passwordCode}</p>
            </div>
            <div className="pt-2 border-t border-border/60">
              <p className="text-2xl font-semibold font-mono">{totalPresent}</p>
              <p className="text-xs text-muted-foreground">Students checked in</p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span>Closes at {new Date(session.expiryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onEnd}
            loading={ending}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            End Session
          </Button>
        </div>
      </div>
    )
  }

  // ── Standard Modal View ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overscroll-contain">
      <div className="relative w-full max-w-2xl bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in-0 zoom-in-98 duration-150">

        {/* Clean Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <h2 className="font-semibold text-base sm:text-lg leading-tight text-foreground">{subjectName}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{subjectCode} · {sessionDurationMinutes} min session</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsProjectorMode(true)}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              title="Full screen presentation"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Present</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">

          {/* Left Column: Pure QR Code */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-full aspect-square max-w-[260px] bg-white p-3 rounded-xl border border-border shadow-xs flex items-center justify-center relative">
              {qrCodeData ? (
                <img
                  src={qrCodeData}
                  alt="Attendance QR Code"
                  className={`w-full h-full object-contain transition-opacity duration-200 ${isRefreshing ? 'opacity-40' : 'opacity-100'}`}
                />
              ) : (
                <QrCode className="w-16 h-16 text-muted-foreground/30 animate-pulse" />
              )}
              {isRefreshing && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                  <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
                </div>
              )}
              {isExpired && (
                <div className="absolute inset-0 rounded-xl bg-background/80 backdrop-blur-xs flex items-center justify-center">
                  <span className="font-medium text-sm text-foreground">Session expired</span>
                </div>
              )}
            </div>

            {/* Minimal refresh info */}
            <div className="flex items-center justify-between w-full max-w-[260px] text-xs text-muted-foreground px-0.5">
              <span>Auto-refreshes in {qrSecondsLeft}s</span>
              <button
                onClick={() => { doRefresh(); setQrSecondsLeft(QR_REFRESH_INTERVAL) }}
                disabled={isRefreshing || isExpired}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Right Column: Natural Information Hierarchy */}
          <div className="flex flex-col justify-between">
            {!showRoster ? (
              <div className="space-y-4">
                {/* Timer */}
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-3xl sm:text-4xl font-semibold font-mono tracking-tight text-foreground ${msLeft < 60_000 ? 'text-destructive' : ''}`}>
                      {isExpired ? '00:00' : formatTimeRemaining(msLeft)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ends at {new Date(session.expiryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Time remaining</p>
                </div>

                <div className="h-px bg-border/60" />

                {/* Manual Entry Codes (Full width rows so codes never wrap) */}
                <div className="space-y-2.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Manual Entry
                  </span>

                  {/* Session Code */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-muted/30">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-medium">Session Code</span>
                      <span className="font-mono text-base font-semibold tracking-wider text-foreground select-all">
                        {session.sessionCode}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(session.sessionCode, 'sessionCode')}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                    >
                      {copiedField === 'sessionCode' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'sessionCode' ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>

                  {/* Passcode */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-muted/30">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block font-medium">Passcode</span>
                      <span className="font-mono text-base font-semibold tracking-wider text-foreground select-all">
                        {session.passwordCode}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(session.passwordCode, 'passwordCode')}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                    >
                      {copiedField === 'passwordCode' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'passwordCode' ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                </div>

                <div className="h-px bg-border/60" />

                {/* Attendees counter */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-foreground">
                      {totalPresent} {totalPresent === 1 ? 'student' : 'students'} present
                    </span>
                  </div>
                  {attendanceRecords.length > 0 && (
                    <button
                      onClick={() => setShowRoster(true)}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    >
                      View list
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Attendees List View */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Attendees ({totalPresent})
                  </span>
                  <button
                    onClick={() => setShowRoster(false)}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Back to codes
                  </button>
                </div>

                {attendanceRecords.length > 4 && (
                  <input
                    type="text"
                    placeholder="Search student..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                )}

                <div className="max-h-52 overflow-y-auto divide-y divide-border/50 pr-1">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record: any, index: number) => {
                      const student = typeof record.studentId === 'object' ? record.studentId : null
                      const name = student?.name || `Student ${index + 1}`
                      const roll = student?.rollNumber || student?.email || ''
                      const time = new Date(record.timestamp || record.createdAt).toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit'
                      })
                      return (
                        <div key={record._id || index} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-medium text-foreground">{name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">{roll}</p>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">{time}</span>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">No students found</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Clean Footer */}
        <div className="px-6 py-3.5 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Expires at {new Date(session.expiryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {confirmEndOpen ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">End this session?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmEndOpen(false)}
                disabled={ending}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={ending}
                onClick={onEnd}
                className="h-8 text-xs"
              >
                End Session
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmEndOpen(true)}
              className="h-8 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
            >
              End Session
            </Button>
          )}
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
