import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Users, TrendingUp, FileDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import ErrorState, { ChartEmpty } from '@/components/shared/ErrorState'
import { teacherService } from '@/services/teacher.service'
import { downloadCSV, getAttendanceColor, formatPercentage } from '@/lib/utils'

const COLORS = ['#2563EB', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']

type StudentStat = {
  studentId: string;
  name: string;
  rollNumber: string;
  present: number;
  totalSessions: number;
  percentage: number;
};

export default function TeacherSubjectAttendancePage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['subject-attendance', subjectId],
    queryFn: () => teacherService.getSubjectAttendance(subjectId!),
    enabled: !!subjectId,
  })

  if (isError) return <ErrorState message="Could not load subject attendance." onRetry={refetch} />

  const handleExport = () => {
    if (!data?.studentStats?.length) return
    downloadCSV(data.studentStats.map((s: StudentStat) => ({
      Name: s.name,
      RollNumber: s.rollNumber,
      Present: s.present,
      TotalSessions: s.totalSessions,
      Percentage: `${s.percentage}%`,
    })), `subject-${data?.subject?.subjectCode}-attendance`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">
            {isLoading ? '…' : data?.subject?.subjectName}
          </h2>
          <p className="text-sm text-muted-foreground font-mono">{data?.subject?.subjectCode}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Total Sessions</p>
              <p className="text-2xl font-bold">{data?.totalSessions ?? 0}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Students Tracked</p>
              <p className="text-2xl font-bold">{data?.studentStats?.length ?? 0}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Avg Attendance</p>
              <p className="text-2xl font-bold">
                {data?.studentStats?.length
                  ? `${Math.round(data.studentStats.reduce((a: number, s: StudentStat) => a + s.percentage, 0) / data.studentStats.length)}%`
                  : '—'}
              </p>
            </CardContent></Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-primary" aria-hidden="true" />
                Attendance % by Student
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.studentStats?.length ? <ChartEmpty label="No attendance data yet" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.studentStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="rollNumber" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }}
                      formatter={(v: number) => [`${v}%`, 'Attendance']} />
                    <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                      {data.studentStats.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Student table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-primary" aria-hidden="true" />
                Student Breakdown ({data?.studentStats?.length ?? 0})
              </CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={!data?.studentStats?.length}>
                <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {!data?.studentStats?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              ) : (
                <div className="divide-y divide-border" role="list">
                  {data.studentStats
                    .sort((a: StudentStat, b: StudentStat) => b.percentage - a.percentage)
                    .map((s: StudentStat, i: number) => (
                      <div key={s.studentId} className="flex items-center gap-3 py-3" role="listitem">
                        <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.rollNumber}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${getAttendanceColor(s.percentage)}`}>
                            {formatPercentage(s.percentage)}
                          </p>
                          <p className="text-xs text-muted-foreground">{s.present}/{s.totalSessions} sessions</p>
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
