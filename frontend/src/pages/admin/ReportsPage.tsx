import { useQuery } from '@tanstack/react-query'
import { FileDown, FileText, Calendar, Users, BookOpen } from 'lucide-react'
import jsPDF from 'jspdf'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { analyticsService } from '@/services/analytics.service'
import { adminService } from '@/services/admin.service'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState, { ChartEmpty } from '@/components/shared/ErrorState'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { downloadCSV } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

const reportCards = [
  {
    title: 'Attendance Summary',
    description: 'Overall attendance rates across all subjects and sessions',
    icon: Calendar,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    type: 'attendance',
  },
  {
    title: 'Student Report',
    description: 'Per-student attendance breakdown and statistics',
    icon: Users,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    type: 'students',
  },
  {
    title: 'Subject Report',
    description: 'Subject-wise attendance trends and session counts',
    icon: BookOpen,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    type: 'subjects',
  },
]

export default function ReportsPage() {
  const { data: analytics, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: analyticsService.getAdminAnalytics,
  })

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminService.getDashboardStats,
  })

  const handleExportCSV = (type: string) => {
    try {
      if (type === 'attendance' && analytics?.dailyAttendance?.length) {
        downloadCSV(analytics.dailyAttendance, 'attendance-summary')
        toast({ title: 'CSV downloaded', variant: 'success' })
      } else if (type === 'subjects' && analytics?.subjectAttendance?.length) {
        downloadCSV(analytics.subjectAttendance, 'subject-report')
        toast({ title: 'CSV downloaded', variant: 'success' })
      } else if (type === 'students' && analytics?.monthlyAttendance?.length) {
        downloadCSV(analytics.monthlyAttendance, 'monthly-report')
        toast({ title: 'CSV downloaded', variant: 'success' })
      } else {
        toast({ title: 'No data to export', description: 'There is no data available for this report yet.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  const handleExportPDF = (type: string) => {
    try {
      let rows: string[][] = []
      let columns: string[] = []
      let title = ''

      if (type === 'attendance' && analytics?.dailyAttendance?.length) {
        title = 'Daily Attendance Summary'
        columns = ['Date', 'Count']
        rows = analytics.dailyAttendance.map((r: { date: string; count: number }) => [r.date, String(r.count)])
      } else if (type === 'subjects' && analytics?.subjectAttendance?.length) {
        title = 'Subject Attendance Report'
        columns = ['Subject Name', 'Subject Code', 'Count']
        rows = analytics.subjectAttendance.map((r: { subjectName: string; subjectCode: string; count: number }) => [r.subjectName, r.subjectCode, String(r.count)])
      } else if (type === 'students' && analytics?.monthlyAttendance?.length) {
        title = 'Monthly Attendance Report'
        columns = ['Month', 'Count']
        rows = analytics.monthlyAttendance.map((r: { month: string; count: number }) => [r.month, String(r.count)])
      } else {
        toast({ title: 'No data to export', description: 'No data available for this report yet.', variant: 'destructive' })
        return
      }

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const left = 14
      let cursorY = 16

      doc.setFontSize(16)
      doc.setTextColor(79, 70, 229)
      doc.text('AttendX', left, cursorY)

      cursorY += 10
      doc.setFontSize(12)
      doc.setTextColor(30, 30, 30)
      doc.text(title, left, cursorY)

      cursorY += 7
      doc.setFontSize(9)
      doc.setTextColor(120, 120, 120)
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, left, cursorY)

      cursorY += 10
      doc.setFontSize(10)
      doc.setTextColor(30, 30, 30)
      doc.setFillColor(79, 70, 229)
      doc.setTextColor(255, 255, 255)
      doc.rect(left, cursorY - 4, pageWidth - left * 2, 8, 'F')
      doc.text(columns.join('  |  '), left + 2, cursorY + 1)

      cursorY += 10
      doc.setTextColor(30, 30, 30)
      rows.forEach((row, index) => {
        if (cursorY > 275) {
          doc.addPage()
          cursorY = 16
        }
        const text = row.join('  |  ')
        if (index % 2 === 0) {
          doc.setFillColor(245, 245, 255)
          doc.rect(left, cursorY - 4, pageWidth - left * 2, 8, 'F')
        }
        doc.text(text, left + 2, cursorY + 1)
        cursorY += 8
      })

      doc.save(`${type}-report-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast({ title: 'PDF downloaded', variant: 'success' })
    } catch {
      toast({ title: 'PDF export failed', variant: 'destructive' })
    }
  }

  const quickStats = [
    { label: 'Total Students',  value: statsData?.totalStudents },
    { label: 'Total Teachers',  value: statsData?.totalTeachers },
    { label: 'Total Subjects',  value: statsData?.totalSubjects },
    { label: 'Attendance Rate', value: statsData ? `${statsData.attendancePercentage}%` : undefined },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Reports</h2>
        <p className="text-sm text-muted-foreground">Generate and export attendance reports</p>
      </div>

      {/* Quick Stats — skeletons while loading */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : quickStats.map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value ?? '—'}</p>
                </CardContent>
              </Card>
            ))
        }
      </div>

      {/* Export Cards — real CSV download wired up, PDF shows "coming soon" toast */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportCards.map((r) => (
          <Card key={r.type} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className={`w-10 h-10 rounded-xl ${r.bg} flex items-center justify-center mb-2`}>
                <r.icon className={`w-5 h-5 ${r.color}`} aria-hidden="true" />
              </div>
              <CardTitle className="text-base">{r.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => handleExportCSV(r.type)}
                aria-label={`Download ${r.title} as CSV`}
              >
                <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => handleExportPDF(r.type)}
                aria-label={`Download ${r.title} as PDF`}
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {isError ? (
        <ErrorState message="Could not load analytics data." onRetry={refetch} />
      ) : (
        <>
          {/* Subject Attendance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="w-4 h-4 text-primary" aria-hidden="true" />
                Subject-wise Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
              ) : !analytics?.subjectAttendance?.length ? (
                <ChartEmpty label="No subject attendance data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.subjectAttendance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="subjectCode" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                    <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Monthly Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
                Monthly Attendance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 bg-muted/30 rounded-xl animate-pulse" aria-hidden="true" />
              ) : !analytics?.monthlyAttendance?.length ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No monthly data available yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {analytics.monthlyAttendance.map((row) => (
                    <div key={row.month} className="flex items-center justify-between py-2.5">
                      <span className="text-sm font-medium">{row.month}</span>
                      <Badge variant="secondary">{row.count} records</Badge>
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
