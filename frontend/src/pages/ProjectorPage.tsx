/**
 * ProjectorPage — Public, no-login full-screen QR display
 * URL: /projector/:sessionCode
 *
 * Designed to be opened on a projector/TV in a seminar hall.
 * Auto-polls for QR updates. Shows countdown, attendance count,
 * session code — everything students need to scan and verify via biometrics.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { QrCode, Users, Clock, MapPin, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import api from '@/lib/axios'

interface ProjectorData {
  sessionCode: string
  qrCodeData: string
  subjectName: string
  subjectCode: string
  title: string | null
  venue: string | null
  sessionType: string
  status: string
  startTime: string
  expiryTime: string
  gracePeriodMinutes: number
  qrRefreshSeconds: number
  qrLastRefreshedAt?: string
  nextRefreshInSeconds?: number
  totalPresent: number
  capacity: number | null
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  class: 'Class',
  seminar: 'Seminar',
  workshop: 'Workshop',
  event: 'Event',
  lab: 'Lab',
}

export default function ProjectorPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>()
  const [data, setData] = useState<ProjectorData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msLeft, setMsLeft] = useState(0)
  const [qrCountdown, setQrCountdown] = useState(15)
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef(false)

  const fetchSession = useCallback(async () => {
    if (!sessionCode || fetchingRef.current) return
    fetchingRef.current = true
    try {
      const res = await api.get(`/attendance/projector/${sessionCode}`)
      const d: ProjectorData = res.data.data
      const refreshSeconds = d.qrRefreshSeconds || 15
      const nextCountdown =
        d.nextRefreshInSeconds && d.nextRefreshInSeconds > 0
          ? Math.min(d.nextRefreshInSeconds, refreshSeconds)
          : refreshSeconds

      setData(d)
      setError(null)
      setQrCountdown(nextCountdown)

      const effectiveExpiry = new Date(d.expiryTime).getTime() + d.gracePeriodMinutes * 60 * 1000
      setMsLeft(Math.max(0, effectiveExpiry - Date.now()))
    } catch (e: any) {
      setError(e.response?.data?.message || 'Session not found')
    } finally {
      fetchingRef.current = false
      setLoading(false)
    }
  }, [sessionCode])

  // Initial fetch
  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  // Countdown timer & QR refresh counter (paused while tab is hidden)
  useEffect(() => {
    if (!data) return
    const tick = setInterval(() => {
      if (document.hidden) return
      const effectiveExpiry = new Date(data.expiryTime).getTime() + data.gracePeriodMinutes * 60 * 1000
      setMsLeft(Math.max(0, effectiveExpiry - Date.now()))
    }, 1000)
    return () => clearInterval(tick)
  }, [data])

  // QR refresh counter + re-fetch (resumes immediately when tab returns visible)
  useEffect(() => {
    if (!data || data.status === 'ended' || data.status === 'expired') return
    const refreshInterval = data.qrRefreshSeconds || 15

    const tick = setInterval(() => {
      if (document.hidden) return
      setQrCountdown(prev => {
        if (prev <= 1) {
          fetchSession()
          return refreshInterval
        }
        return prev - 1
      })
    }, 1000)

    const onVisibilityChange = () => {
      if (!document.hidden) {
        fetchSession()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [data?.qrRefreshSeconds, data?.status, fetchSession])

  // Page title
  useEffect(() => {
    if (data) {
      document.title = `${data.title || data.subjectName} · AttendX`
    }
  }, [data])

  const isExpired = msLeft <= 0
  const isEnded = data?.status === 'ended' || data?.status === 'expired'
  const displayName = data?.title || data?.subjectName || 'Attendance Session'

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <RefreshCw className="w-8 h-8 text-primary animate-spin" />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center p-6">
      <XCircle className="w-16 h-16 text-destructive opacity-60" />
      <div>
        <h1 className="text-2xl font-bold">Session Not Found</h1>
        <p className="text-muted-foreground mt-2">{error || 'This session does not exist.'}</p>
      </div>
    </div>
  )

  if (isEnded) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 text-center p-6">
      <CheckCircle className="w-20 h-20 text-emerald-500" />
      <div>
        <h1 className="text-3xl font-bold">{displayName}</h1>
        <p className="text-muted-foreground text-lg mt-2">Attendance session has ended.</p>
        <p className="text-5xl font-bold font-mono mt-6 text-emerald-600">{data.totalPresent}</p>
        <p className="text-muted-foreground">students marked present</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col select-none overflow-hidden">

      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border/60 bg-card/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{displayName}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="font-mono font-semibold text-foreground">{data.subjectCode}</span>
            <span>·</span>
            <span>{SESSION_TYPE_LABEL[data.sessionType] || data.sessionType}</span>
            {data.venue && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{data.venue}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-5xl font-mono font-bold tracking-tight ${
            msLeft < 60_000 ? 'text-destructive' : msLeft < 300_000 ? 'text-amber-500' : 'text-foreground'
          }`}>
            {formatCountdown(msLeft)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Time remaining</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 xl:gap-20 p-8 sm:p-12">

        {/* QR Code */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative bg-white p-5 rounded-3xl shadow-2xl border border-border">
            {data.qrCodeData ? (
              <img
                src={data.qrCodeData}
                alt="Attendance QR Code"
                className="w-72 h-72 sm:w-80 sm:h-80 xl:w-96 xl:h-96 object-contain"
              />
            ) : (
              <div className="w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
                <QrCode className="w-24 h-24 text-muted-foreground/30 animate-pulse" />
              </div>
            )}

            {/* QR refresh ring */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-full px-4 py-1.5 flex items-center gap-2 text-xs text-muted-foreground shadow-sm">
              <RefreshCw className="w-3 h-3" />
              <span>Refreshes in <strong>{qrCountdown}s</strong></span>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Scan with <span className="font-semibold text-foreground">AttendX</span> app → Verify with Fingerprint / Face ID
          </div>
        </div>

        {/* Info panel */}
        <div className="space-y-8 max-w-sm w-full">

          {/* Session Code */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-2">
              Session Code
            </p>
            <p className="font-mono text-4xl xl:text-5xl font-bold tracking-wider text-foreground">
              {data.sessionCode}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Enter in app if camera unavailable
            </p>
          </div>

          {/* Live count */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-4xl font-bold font-mono text-emerald-600">
                {data.totalPresent}
                {data.capacity && (
                  <span className="text-xl text-muted-foreground font-normal">/{data.capacity}</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.capacity
                  ? `students present · ${data.capacity - data.totalPresent} seats left`
                  : 'students present'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground/60">
        <span>Powered by <strong>AttendX</strong></span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live · Updates every {data.qrRefreshSeconds}s
        </span>
        <span>Closes at {new Date(data.expiryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  )
}
