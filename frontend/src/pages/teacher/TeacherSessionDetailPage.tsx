import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Users, Clock, Hash, CheckCircle2, FileDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ErrorState from '@/components/shared/ErrorState'
import { teacherService } from '@/services/teacher.service'
import { formatDate, formatTime, downloadCSV, generateAvatarUrl } from '@/lib/utils'

type RecordType = {
  _id: string;
  studentId: {
    name: string;
    rollNumber: string;
    year: string;
    section: string;
    department: string;
  };
  timestamp: string;
  verificationStatus: string;
};

export default function TeacherSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['session-report', sessionId],
    queryFn: () => teacherService.getSessionReport(sessionId!),
    enabled: !!sessionId,
  })

  if (isError) return <ErrorState message="Could not load session report." onRetry={refetch} />

  const handleExport = () => {
    if (!data?.records?.length) return
    const rows = data.records.map((r: RecordType) => ({
      Name: r.studentId?.name || '',
      RollNumber: r.studentId?.rollNumber || '',
      Year: r.studentId?.year || '',
      Section: r.studentId?.section || '',
      Department: r.studentId?.department || '',
      Time: formatTime(r.timestamp),
      Status: r.verificationStatus,
    }))
    downloadCSV(rows, `session-${data.session?.sessionCode}-attendance`)
  }

  const session = data?.session
  const records = data?.records || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">Session Report</h2>
          <p className="text-sm text-muted-foreground">
            {session ? `${typeof session.subjectId === 'object' && session.subjectId !== null ? (session.subjectId as { subjectName: string }).subjectName : 'Unknown'} · ${formatDate(session.startTime)}` : '…'}
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
              { label: 'Total Present', value: data.totalPresent, icon: Users },
              { label: 'Started', value: formatTime(session.startTime), icon: Clock },
              { label: 'Status', value: session.status, icon: CheckCircle2 },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    <p className="text-xs">{label}</p>
                  </div>
                  <p className="text-lg font-bold capitalize">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Attendance list */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-primary" aria-hidden="true" />
                Attendance ({records.length} students)
              </CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={!records.length}>
                <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No students marked attendance</p>
              ) : (
                <div className="divide-y divide-border" role="list">
                  {records.map((r: RecordType, i: number) => (
                    <div key={r._id} className="flex items-center gap-3 py-3" role="listitem">
                      <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                      <img src={generateAvatarUrl(r.studentId?.name || 'S')} alt="" aria-hidden="true" className="w-8 h-8 rounded-full" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.studentId?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.studentId?.rollNumber} · Year {r.studentId?.year} · Sec {r.studentId?.section}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">{formatTime(r.timestamp)}</p>
                        <Badge variant={r.verificationStatus === 'verified' ? 'success' : 'secondary'} className="mt-0.5">
                          {r.verificationStatus}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
