import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Users, Clock, Hash, CheckCircle2, FileDown, UserX, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ErrorState from '@/components/shared/ErrorState'
import { formatDate, formatTime, downloadCSV, generateAvatarUrl } from '@/lib/utils'
import api from '@/lib/axios'
import { toast } from '@/hooks/useToast'

type PresentRecord = {
  _id: string
  studentId: {
    name: string
    rollNumber: string
    year: string
    section: string
    department: string
  }
  timestamp: string
  verificationStatus: string
  verificationMethod?: string
  isLate?: boolean
}

type AbsentStudent = {
  _id: string
  name: string
  rollNumber: string
  email: string
  year: string
  section: string
  department: string
}

export default function TeacherSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'present' | 'absent'>('present')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['session-report', sessionId],
    queryFn: async () => {
      const res = await api.get(`/attendance/sessions/${sessionId}/report`)
      return res.data.data
    },
    enabled: !!sessionId,
  })

  if (isError) return <ErrorState message="Could not load session report." onRetry={refetch} />

  const session = data?.session
  const records: PresentRecord[] = data?.records || []
  const absentStudents: AbsentStudent[] = data?.absentStudents || []
  const sessionType: string = session?.sessionType || 'class'
  const venue: string | null = session?.venue || null

  const handleExportPresent = () => {
    if (!records.length) return
    const rows = records.map((r) => ({
      Name: r.studentId?.name || '',
      RollNumber: r.studentId?.rollNumber || '',
      Year: r.studentId?.year || '',
      Section: r.studentId?.section || '',
      Department: r.studentId?.department || '',
      Status: 'Present',
      Time: formatTime(r.timestamp),
      Method: r.verificationMethod || 'password',
      Late: r.isLate ? 'Yes' : 'No',
    }))
    downloadCSV(rows, `${session?.sessionCode}-present`)
  }

  const handleExportAbsent = () => {
    if (!absentStudents.length) return
    const rows = absentStudents.map((s) => ({
      Name: s.name || '',
      RollNumber: s.rollNumber || '',
      Year: s.year || '',
      Section: s.section || '',
      Department: s.department || '',
      Status: 'Absent',
    }))
    downloadCSV(rows, `${session?.sessionCode}-absent`)
  }

  const handleExportAll = async () => {
    try {
      const res = await api.get(`/attendance/sessions/${sessionId}/export?type=all`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${session?.sessionCode}-full-report.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  const SESSION_TYPE_EMOJI: Record<string, string> = {
    class: '🎓', seminar: '🎤', workshop: '🛠️', event: '🎉', lab: '🧪',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">Session Report</h2>
          <p className="text-sm text-muted-foreground truncate">
            {session
              ? `${typeof session.subjectId === 'object' ? (session.subjectId as any).subjectName : 'Unknown'} · ${formatDate(session.startTime)}`
              : '…'
            }
            {session?.sessionType && ` · ${SESSION_TYPE_EMOJI[sessionType] || ''} ${sessionType}`}
            {venue && ` · ${venue}`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />)}
        </div>
      ) : session && (
        <>
          {/* Session summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Session Code', value: session.sessionCode, icon: Hash },
              { label: 'Present', value: records.length, icon: Users },
              { label: 'Absent', value: absentStudents.length, icon: UserX },
              { label: 'Status', value: session.status, icon: CheckCircle2 },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Icon className="w-3.5 h-3.5" />
                    <p className="text-xs">{label}</p>
                  </div>
                  <p className="text-lg font-bold capitalize">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Projector link for active sessions */}
          {session.status === 'active' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
              <span className="text-muted-foreground">Session is live —</span>
              <button
                onClick={() => window.open(`/projector/${session.sessionCode}`, '_blank')}
                className="flex items-center gap-1 text-primary hover:underline font-medium"
              >
                Open Projector View <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Export + Tabs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap pb-3">
              <div className="flex border rounded-lg overflow-hidden">
                <button
                  onClick={() => setTab('present')}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'present' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                >
                  Present ({records.length})
                </button>
                {absentStudents.length > 0 && (
                  <button
                    onClick={() => setTab('absent')}
                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'absent' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                  >
                    Absent ({absentStudents.length})
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {tab === 'present' && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPresent} disabled={!records.length}>
                    <FileDown className="w-3.5 h-3.5" /> Present CSV
                  </Button>
                )}
                {tab === 'absent' && absentStudents.length > 0 && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportAbsent}>
                    <FileDown className="w-3.5 h-3.5" /> Absent CSV
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportAll}>
                  <FileDown className="w-3.5 h-3.5" /> Full Report
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {/* PRESENT TAB */}
              {tab === 'present' && (
                records.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No students marked attendance</p>
                ) : (
                  <div className="divide-y divide-border" role="list">
                    {records.map((r, i) => (
                      <div key={r._id} className="flex items-center gap-3 py-3" role="listitem">
                        <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                        <img src={generateAvatarUrl(r.studentId?.name || 'S')} alt="" className="w-8 h-8 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{r.studentId?.name}</p>
                            {r.isLate && (
                              <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">Late</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {r.studentId?.rollNumber} · Year {r.studentId?.year} · Sec {r.studentId?.section}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-muted-foreground">{formatTime(r.timestamp)}</p>
                          <Badge variant={r.verificationStatus === 'verified' ? 'success' : 'secondary'} className="mt-0.5">
                            {r.verificationMethod || r.verificationStatus}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ABSENT TAB */}
              {tab === 'absent' && (
                absentStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">All enrolled students marked attendance 🎉</p>
                ) : (
                  <div className="divide-y divide-border" role="list">
                    {absentStudents.map((s, i) => (
                      <div key={s._id} className="flex items-center gap-3 py-3" role="listitem">
                        <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                        <img src={generateAvatarUrl(s.name || 'S')} alt="" className="w-8 h-8 rounded-full opacity-50" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-muted-foreground truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.rollNumber} · Year {s.year} · Sec {s.section}
                          </p>
                        </div>
                        <Badge variant="error" className="shrink-0">Absent</Badge>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
