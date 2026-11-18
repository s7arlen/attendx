import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Users, TrendingUp, CheckCircle, Brain, RefreshCw, Eye, Plus } from 'lucide-react'
import { academicService } from '@/services/academic.service'
import { RiskLevel, User, ContributingFactor } from '@/types'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/useToast'

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  HIGH:       { label: 'High Risk',     color: 'text-red-700',    bg: 'bg-red-50 border-red-200',      icon: 'ðŸ”´' },
  MODERATE:   { label: 'Moderate Risk', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',  icon: 'ðŸŸ¡' },
  LOW:        { label: 'Low Risk',      color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  icon: 'ðŸŸ¢' },
  UNASSESSED: { label: 'Not Assessed',  color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200',  icon: 'âšª' },
}

function RiskBadge({ level }: { level: string }) {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.UNASSESSED
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg}`}>
      <span>{cfg.icon}</span> {cfg.label}
    </span>
  )
}

export default function RiskDashboardPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState<string>('ALL')
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [interventionDialog, setInterventionDialog] = useState(false)
  const [interventionForm, setInterventionForm] = useState({ type: 'mentoring', description: '', scheduledDate: '' })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['risk-dashboard'],
    queryFn: academicService.getRiskDashboard,
  })

  const triggerMutation = useMutation({
    mutationFn: (studentId: string) => academicService.triggerRisk(studentId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['risk-dashboard'] }); toast({ title: 'Risk reassessed', variant: 'success' }) },
  })

  const interventionMutation = useMutation({
    mutationFn: (d: any) => academicService.createIntervention(d),
    onSuccess: () => {
      toast({ title: 'Intervention created', variant: 'success' })
      setInterventionDialog(false)
      setInterventionForm({ type: 'mentoring', description: '', scheduledDate: '' })
    },
  })

  const filtered = (data?.allStudents || []).filter(s => {
    const name = (s.student as User)?.name?.toLowerCase() || ''
    const roll = (s.student as User)?.rollNumber?.toLowerCase() || ''
    const matchSearch = !search || name.includes(search.toLowerCase()) || roll.includes(search.toLowerCase())
    const matchRisk = filterRisk === 'ALL' || s.riskLevel === filterRisk
    return matchSearch && matchRisk
  })

  if (isLoading) return (
    <div className="p-6 space-y-4">
      {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
    </div>
  )

  if (isError) return (
    <div className="p-6 text-center text-muted-foreground">Failed to load risk dashboard. <button onClick={() => refetch()} className="text-primary underline">Retry</button></div>
  )

  const summary = data?.summary

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-primary" /> Early Warning Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-powered academic risk assessment â€” Rule-Based v1.0</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: summary?.total || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'High Risk',      value: summary?.high || 0,  icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Moderate Risk',  value: summary?.moderate || 0, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Low Risk',       value: summary?.low || 0,   icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(c => (
          <div key={c.label} className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* High Risk Alert */}
      {(summary?.high || 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {summary?.high} student(s) are at HIGH academic risk and require immediate faculty intervention.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text" placeholder="Search by name or roll number..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select
          value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
          className="px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none"
        >
          <option value="ALL">All Risk Levels</option>
          <option value="HIGH">High Risk</option>
          <option value="MODERATE">Moderate Risk</option>
          <option value="LOW">Low Risk</option>
          <option value="UNASSESSED">Not Assessed</option>
        </select>
      </div>

      {/* Student Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Student</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Roll No.</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Attendance</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Internal Avg</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Risk Level</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Last Assessed</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No students found</td></tr>
              ) : filtered.map(s => {
                const student = s.student as User
                const riskData = data?.allStudents.find(x => (x.student as User)?.id === student?.id || (x.student as User)?.id === student?.id)
                const fullData = data?.highRiskStudents.find(x => (x.student as User)?.id === student?.id || (x.student as User)?.id === student?.id)
                return (
                  <tr key={student?.id || student?.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{student?.name}</div>
                      <div className="text-xs text-muted-foreground">{student?.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{student?.rollNumber || 'â€”'}</td>
                    <td className="px-4 py-3">
                      {fullData?.attendancePercentage != null ? (
                        <span className={`font-semibold ${fullData.attendancePercentage < 75 ? 'text-red-600' : 'text-green-600'}`}>
                          {fullData.attendancePercentage}%
                        </span>
                      ) : 'â€”'}
                    </td>
                    <td className="px-4 py-3">
                      {fullData?.internalMarksAverage != null ? (
                        <span className={`font-semibold ${fullData.internalMarksAverage < 50 ? 'text-red-600' : 'text-green-600'}`}>
                          {fullData.internalMarksAverage}%
                        </span>
                      ) : 'â€”'}
                    </td>
                    <td className="px-4 py-3"><RiskBadge level={s.riskLevel} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.lastAssessed ? formatDate(s.lastAssessed) : 'â€”'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View Profile"
                          onClick={() => setSelectedStudent(s)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Reassess Risk"
                          onClick={() => triggerMutation.mutate(student?.id || student?.id)}
                          disabled={triggerMutation.isPending}>
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary" title="Create Intervention"
                          onClick={() => { setSelectedStudent(s); setInterventionDialog(true) }}>
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Detail Dialog */}
      {selectedStudent && !interventionDialog && (
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Risk Assessment â€” {(selectedStudent.student as User)?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <RiskBadge level={selectedStudent.riskLevel} />
                <span className="text-sm text-muted-foreground">Score: {selectedStudent.riskScore}/100</span>
              </div>
              {/* Contributing Factors */}
              {selectedStudent.riskLevel !== 'UNASSESSED' && (
                <div>
                  <p className="text-sm font-semibold mb-2">Contributing Factors</p>
                  {(data?.highRiskStudents.find((x: any) => (x.student as User)?.id === (selectedStudent.student as User)?.id)?.factors || []).map((f: ContributingFactor, i: number) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0">
                      <span className="text-sm">{f.factor}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{f.value}{typeof f.value === 'number' ? '%' : ''}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${f.impact === 'HIGH' ? 'bg-red-100 text-red-700' : f.impact === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{f.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedStudent(null)}>Close</Button>
                <Button onClick={() => setInterventionDialog(true)}>Create Intervention</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Intervention Dialog */}
      <Dialog open={interventionDialog} onOpenChange={setInterventionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Intervention â€” {(selectedStudent?.student as User)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Type</label>
              <select value={interventionForm.type} onChange={e => setInterventionForm(f => ({ ...f, type: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background">
                <option value="mentoring">Mentoring</option>
                <option value="counselling">Counselling</option>
                <option value="remedial_class">Remedial Class</option>
                <option value="subject_support">Subject Support</option>
                <option value="assignment_help">Assignment Help</option>
                <option value="parent_meeting">Parent Meeting</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea value={interventionForm.description} onChange={e => setInterventionForm(f => ({ ...f, description: e.target.value }))}
                rows={3} className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none" placeholder="Describe the intervention..." />
            </div>
            <div>
              <label className="text-sm font-medium">Scheduled Date</label>
              <input type="date" value={interventionForm.scheduledDate} onChange={e => setInterventionForm(f => ({ ...f, scheduledDate: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterventionDialog(false)}>Cancel</Button>
            <Button onClick={() => interventionMutation.mutate({
              studentId: (selectedStudent?.student as User)?.id || (selectedStudent?.student as User)?.id,
              type: interventionForm.type,
              description: interventionForm.description,
              scheduledDate: interventionForm.scheduledDate,
            })} disabled={interventionMutation.isPending || !interventionForm.description || !interventionForm.scheduledDate}>
              Create Intervention
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

