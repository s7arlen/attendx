import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, MapPin, BookOpen, Zap, CheckCircle, AlertCircle, Play, Users, RefreshCw, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { teacherService } from '@/services/teacher.service'
import { Timetable, Subject } from '@/types'
import api from '@/lib/axios'
import { toast } from '@/hooks/useToast'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

type SlotStatus = 'live' | 'upcoming' | 'done' | 'missed'

interface TodaySlot {
  timetableId: string
  subjectName: string
  subjectCode: string
  startTime: string
  endTime: string
  room: string | null
  status: SlotStatus
  minutesUntilStart: number | null
  autoSessionWillStart: boolean
  session: {
    id: string
    passwordCode: string
    sessionCode: string
    totalPresent: number
    status: string
    autoCreated: boolean
  } | null
}

const STATUS_CONFIG: Record<SlotStatus, { label: string; color: string; bg: string; icon: any }> = {
  live:     { label: 'Live Now',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   icon: Play },
  upcoming: { label: 'Upcoming',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     icon: Clock },
  done:     { label: 'Completed', color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200',   icon: CheckCircle },
  missed:   { label: 'No Session',color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   icon: AlertCircle },
}

function LiveCountdown({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState(minutes * 60)
  useEffect(() => {
    const timer = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(timer)
  }, [])
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return (
    <span className="font-mono text-sm font-bold text-blue-600">
      {m}:{s.toString().padStart(2, '0')}
    </span>
  )
}

export default function SmartTimetablePage() {
  const qc = useQueryClient()
  const [view, setView] = useState<'today' | 'weekly'>('today')
  const [startingSession, setStartingSession] = useState<string | null>(null)

  // Today's auto-session status
  const { data: todayData, isLoading: loadingToday, refetch: refetchToday } = useQuery({
    queryKey: ['auto-sessions-today'],
    queryFn: () => api.get('/teacher/auto-sessions/today').then(r => r.data.data),
    refetchInterval: 30000, // refresh every 30s
  })

  // Weekly timetable
  const { data: timetable, isLoading: loadingWeekly } = useQuery({
    queryKey: ['teacher-timetable'],
    queryFn: teacherService.getMyTimetable,
    enabled: view === 'weekly',
  })

  const getSlotsByDay = (day: string) =>
    (timetable || []).filter(slot => slot.day === day)

  const startManualSession = async (slot: TodaySlot) => {
    setStartingSession(slot.timetableId)
    try {
      // Find subjectId from timetable
      const timetableRes = await api.get('/teacher/timetable')
      const timetableEntry = timetableRes.data.data.timetable.find(
        (t: any) => t._id === slot.timetableId
      )
      const subjectId = typeof timetableEntry?.subjectId === 'object'
        ? timetableEntry.subjectId._id
        : timetableEntry?.subjectId

      const duration = (() => {
        const [sh, sm] = slot.startTime.split(':').map(Number)
        const [eh, em] = slot.endTime.split(':').map(Number)
        return (eh * 60 + em) - (sh * 60 + sm)
      })()

      await api.post('/attendance/start-session', { subjectId, duration })
      toast({ title: '✅ Session started', description: `${slot.subjectName} — Code will appear shortly`, variant: 'success' })
      refetchToday()
    } catch (e: any) {
      toast({ title: 'Error', description: e.response?.data?.message || 'Failed to start session', variant: 'destructive' })
    } finally {
      setStartingSession(null)
    }
  }

  const endSession = async (sessionId: string, subjectName: string) => {
    try {
      await api.post(`/attendance/end-session/${sessionId}`)
      toast({ title: '⏹ Session ended', description: subjectName, variant: 'success' })
      refetchToday()
    } catch (e: any) {
      toast({ title: 'Error', description: e.response?.data?.message, variant: 'destructive' })
    }
  }

  const slots: TodaySlot[] = todayData?.slots || []
  const liveSlots = slots.filter(s => s.status === 'live')
  const upcomingSlots = slots.filter(s => s.status === 'upcoming')

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> Smart Timetable
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sessions start automatically 2 min before class · Today: {todayData?.day || '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetchToday()}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={() => setView('today')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'today' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              Today
            </button>
            <button onClick={() => setView('weekly')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'weekly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              Weekly
            </button>
          </div>
        </div>
      </div>

      {/* How it works banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <span className="font-semibold text-primary">Auto Session Magic: </span>
          <span className="text-muted-foreground">
            The system automatically starts your attendance session 2 minutes before each class and ends it at the scheduled time.
            Students get notified instantly. No manual action needed.
          </span>
        </div>
      </div>

      {/* TODAY VIEW */}
      {view === 'today' && (
        <div className="space-y-4">

          {/* Live sessions alert */}
          {liveSlots.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-green-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                {liveSlots.length} session{liveSlots.length > 1 ? 's' : ''} LIVE right now
              </p>
              {liveSlots.map(slot => (
                <div key={slot.timetableId} className="flex items-center justify-between gap-3 bg-white rounded-lg p-3 border border-green-200">
                  <div>
                    <p className="font-semibold text-sm">{slot.subjectName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Code: <strong>{slot.session?.passwordCode}</strong> · {slot.session?.totalPresent} present
                    </p>
                    {slot.session?.autoCreated && (
                      <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5"><Zap className="w-3 h-3" /> Auto-started</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                    onClick={() => slot.session && endSession(slot.session.id, slot.subjectName)}>
                    End Session
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming sessions */}
          {upcomingSlots.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-800">Upcoming Today</p>
              {upcomingSlots.map(slot => (
                <div key={slot.timetableId} className="flex items-center justify-between gap-3 bg-white rounded-lg p-3 border border-blue-200">
                  <div>
                    <p className="font-semibold text-sm">{slot.subjectName}</p>
                    <p className="text-xs text-muted-foreground">
                      {slot.startTime} – {slot.endTime}
                      {slot.room && ` · Room ${slot.room}`}
                    </p>
                    {slot.autoSessionWillStart && (
                      <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                        <Zap className="w-3 h-3" />
                        Auto-starts in {slot.minutesUntilStart != null ? (
                          <LiveCountdown minutes={slot.minutesUntilStart} />
                        ) : '—'}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 gap-1.5"
                    disabled={startingSession === slot.timetableId}
                    onClick={() => startManualSession(slot)}>
                    <Play className="w-3 h-3" />
                    {startingSession === slot.timetableId ? 'Starting...' : 'Start Now'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* All today's slots */}
          {loadingToday ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-16 bg-card border rounded-xl text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No classes scheduled for today</p>
              <p className="text-sm mt-1">Switch to Weekly view to see your full schedule</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">{todayData?.day} Schedule</p>
              {slots.map(slot => {
                const cfg = STATUS_CONFIG[slot.status]
                const Icon = cfg.icon
                return (
                  <div key={slot.timetableId} className={`border rounded-xl p-4 ${cfg.bg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{slot.subjectName}</span>
                          <span className="text-xs font-mono text-muted-foreground">{slot.subjectCode}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cfg.color} bg-white/60`}>
                            <Icon className="w-3 h-3" /> {cfg.label}
                          </span>
                          {slot.session?.autoCreated && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                              <Zap className="w-3 h-3" /> Auto
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{slot.startTime} – {slot.endTime}</span>
                          {slot.room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{slot.room}</span>}
                          {slot.session && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{slot.session.totalPresent} present</span>}
                        </div>
                        {slot.session && (
                          <p className="text-xs mt-1 font-mono">
                            Code: <strong>{slot.session.passwordCode}</strong>
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex gap-2">
                        {slot.status === 'live' && slot.session && (
                          <Button size="sm" variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs"
                            onClick={() => endSession(slot.session!.id, slot.subjectName)}>
                            End
                          </Button>
                        )}
                        {slot.status === 'missed' && (
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
                            disabled={startingSession === slot.timetableId}
                            onClick={() => startManualSession(slot)}>
                            <Play className="w-3 h-3" /> Start
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* WEEKLY VIEW */}
      {view === 'weekly' && (
        <div>
          {loadingWeekly ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted/30 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {DAYS.map(day => {
                const slots = getSlotsByDay(day)
                const isToday = day === todayData?.day
                return (
                  <Card key={day} className={isToday ? 'ring-2 ring-primary' : ''}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                        <span>{day}</span>
                        {isToday && <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-medium">Today</span>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {slots.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No classes</p>
                      ) : (
                        slots.map((slot: Timetable) => {
                          const sub = typeof slot.subjectId === 'object' ? slot.subjectId : null
                          const subjectName = sub?.subjectName || (typeof slot.subjectId === 'string' ? slot.subjectId : 'Subject')
                          return (
                            <div key={slot._id} className="p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                                  <span className="text-sm font-medium">{subjectName}</span>
                                </div>
                                <Badge variant="secondary" className="text-xs shrink-0">{sub?.subjectCode}</Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{slot.startTime} – {slot.endTime}</span>
                                {slot.room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{slot.room}</span>}
                              </div>
                              {isToday && (
                                <p className="text-xs text-primary flex items-center gap-1 mt-1.5">
                                  <Zap className="w-3 h-3" /> Auto-session enabled
                                </p>
                              )}
                            </div>
                          )
                        })
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
