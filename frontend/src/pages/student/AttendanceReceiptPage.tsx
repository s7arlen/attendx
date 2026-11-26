/**
 * AttendanceReceiptPage — Student proof-of-attendance
 * URL: /student/receipt/:sessionId
 *
 * Shows a timestamped digital slip a student can use as gate-entry proof.
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, MapPin, BookOpen, ArrowLeft, Download, Fingerprint, WifiOff, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/axios'
import { formatDate, formatTime } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const METHOD_LABELS: Record<string, { label: string; icon: any }> = {
  qr:           { label: 'QR Scan', icon: Hash },
  password:     { label: 'Password', icon: Hash },
  biometric:    { label: 'Biometric', icon: Fingerprint },
  offline_sync: { label: 'Offline Sync', icon: WifiOff },
  manual:       { label: 'Manual Entry', icon: Hash },
}

export default function AttendanceReceiptPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance-receipt', sessionId],
    queryFn: async () => {
      const res = await api.get(`/attendance/receipt/${sessionId}`)
      return res.data.data
    },
    enabled: !!sessionId,
  })

  const handlePrint = () => window.print()

  if (isLoading) return (
    <div className="max-w-md mx-auto mt-10 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />
      ))}
    </div>
  )

  if (isError || !data) return (
    <div className="max-w-md mx-auto mt-10 text-center space-y-3">
      <p className="text-muted-foreground">No attendance record found for this session.</p>
      <Button variant="outline" onClick={() => navigate('/student/attendance')}>
        Back to Attendance
      </Button>
    </div>
  )

  const { record, subject, session: sess, student } = data
  const methodInfo = METHOD_LABELS[record.verificationMethod] || { label: record.verificationMethod, icon: Hash }
  const MethodIcon = methodInfo.icon

  return (
    <div className="max-w-md mx-auto space-y-4 print:p-0 print:max-w-none">

      {/* Back button — hidden on print */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-muted-foreground">Attendance Receipt</span>
      </div>

      {/* Receipt Card */}
      <div className="bg-card border-2 border-emerald-200 dark:border-emerald-900/50 rounded-2xl overflow-hidden shadow-sm print:border print:rounded-none print:shadow-none">

        {/* Green header */}
        <div className="bg-emerald-500/10 px-6 py-5 flex items-center gap-4 border-b border-emerald-200 dark:border-emerald-900/40">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-md">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg text-emerald-800 dark:text-emerald-300">Attendance Confirmed</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {formatDate(record.timestamp)} · {formatTime(record.timestamp)}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Student */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Student</p>
              <p className="font-semibold text-base mt-0.5">{student?.name || user?.name}</p>
              <p className="text-sm text-muted-foreground font-mono">
                {student?.rollNumber || user?.rollNumber}
              </p>
            </div>
            <Badge variant="success" className="mt-1">Present</Badge>
          </div>

          <div className="border-t border-border/50" />

          {/* Subject & Session */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Subject</p>
                <p className="font-medium text-sm">
                  {typeof subject === 'object' ? subject.subjectName : 'Unknown'}
                  {typeof subject === 'object' && subject.subjectCode && (
                    <span className="ml-2 text-xs font-mono text-muted-foreground">({subject.subjectCode})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Session</p>
                <p className="font-medium text-sm font-mono">
                  {sess?.sessionCode}
                  {sess?.sessionType && (
                    <span className="ml-2 text-xs text-muted-foreground capitalize font-sans">
                      ({sess.sessionType})
                    </span>
                  )}
                </p>
                {sess?.startTime && (
                  <p className="text-xs text-muted-foreground">
                    Started {formatTime(sess.startTime)}
                  </p>
                )}
              </div>
            </div>

            {sess?.venue && (
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Venue</p>
                  <p className="font-medium text-sm">{sess.venue}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <MethodIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Verified via</p>
                <p className="font-medium text-sm capitalize">
                  {methodInfo.label}
                  {record.isLate && (
                    <span className="ml-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                      Late entry accepted
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Department info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{student?.department || user?.department}</span>
            <span>
              Year {student?.year || user?.year} · Sec {student?.section || user?.section}
            </span>
          </div>
        </div>

        {/* Footer stamp */}
        <div className="bg-muted/30 px-6 py-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50">
          <span>AttendX · Verified</span>
          <span className="font-mono">{new Date(record.timestamp).toISOString().slice(0, 19).replace('T', ' ')}</span>
        </div>
      </div>

      {/* Actions — hidden on print */}
      <div className="flex gap-2 print:hidden">
        <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
          <Download className="w-4 h-4" />
          Save / Print
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate('/student/attendance')}>
          View All Attendance
        </Button>
      </div>
    </div>
  )
}
