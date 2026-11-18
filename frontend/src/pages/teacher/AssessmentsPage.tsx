import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, BookOpen, Users, CheckCircle, Edit, Eye, Trash2,
  Download, Search, Filter, BarChart2, AlertCircle, X
} from 'lucide-react'
import { academicService } from '@/services/academic.service'
import { Assessment, AssessmentType, AssessmentResult, Subject, User } from '@/types'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/useToast'
import { teacherService } from '@/services/teacher.service'

const TYPE_LABELS: Record<AssessmentType, string> = {
  internal_exam: 'Internal Exam',
  unit_test:     'Unit Test',
  quiz:          'Quiz',
  assignment:    'Assignment',
  practical:     'Practical',
  project:       'Project',
  other:         'Other',
}

const TYPE_COLORS: Record<AssessmentType, string> = {
  internal_exam: 'bg-blue-100 text-blue-700',
  unit_test:     'bg-purple-100 text-purple-700',
  quiz:          'bg-amber-100 text-amber-700',
  assignment:    'bg-green-100 text-green-700',
  practical:     'bg-teal-100 text-teal-700',
  project:       'bg-orange-100 text-orange-700',
  other:         'bg-slate-100 text-slate-700',
}

const EMPTY_FORM = {
  title: '', type: 'internal_exam', subjectId: '',
  maxMarks: '', assessmentDate: '', dueDate: '', description: '',
}

// ── Results View ──────────────────────────────────────────────
function ResultsView({ assessment, onClose }: { assessment: Assessment; onClose: () => void }) {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-results', assessment._id],
    queryFn: () => academicService.getAssessmentResults(assessment._id),
  })

  const filtered = useMemo(() => {
    const list = data?.results || []
    if (!search) return list
    return list.filter(r => {
      const s = r.studentId as User
      return s?.name?.toLowerCase().includes(search.toLowerCase()) ||
             s?.rollNumber?.toLowerCase().includes(search.toLowerCase())
    })
  }, [data?.results, search])

  const stats = data?.stats

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Total',   value: stats.total },
            { label: 'Appeared', value: stats.appeared },
            { label: 'Average', value: `${stats.average}` },
            { label: 'Highest', value: stats.highest },
            { label: 'Passed',  value: stats.passCount },
          ].map(s => (
            <div key={s.label} className="text-center bg-muted/40 rounded-lg p-2">
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or roll number..."
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Results table */}
      <div className="max-h-72 overflow-y-auto rounded-lg border">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading results...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No results found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Student</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Roll No.</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Marks</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">%</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(r => {
                const s = r.studentId as User
                const pct = r.isAbsent ? 0 : Math.round((r.marksObtained / (data?.assessment.maxMarks || 1)) * 100)
                const pass = !r.isAbsent && r.marksObtained >= (data?.assessment.maxMarks || 1) * 0.4
                return (
                  <tr key={r._id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{s?.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{s?.rollNumber}</td>
                    <td className="px-3 py-2 text-center">
                      {r.isAbsent ? <span className="text-slate-400">Absent</span> : `${r.marksObtained}/${data?.assessment.maxMarks}`}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.isAbsent ? '—' : (
                        <span className={`font-semibold ${pct < 40 ? 'text-red-600' : pct < 60 ? 'text-amber-600' : 'text-green-600'}`}>
                          {pct}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.isAbsent
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Absent</span>
                        : <span className={`text-xs px-2 py-0.5 rounded-full ${pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {pass ? 'Pass' : 'Fail'}
                          </span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" size="sm" className="gap-2"
          onClick={() => academicService.exportAssessmentCSV(assessment._id)}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}

// ── Marks Entry ───────────────────────────────────────────────
function MarksEntry({
  assessment, onClose, onSaved,
}: { assessment: Assessment; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [marksData, setMarksData] = useState<Record<string, { marks: string; absent: boolean }>>({})
  const [initialized, setInitialized] = useState(false)

  const sub = assessment.subjectId as Subject
  const subjectId = typeof assessment.subjectId === 'string' ? assessment.subjectId : (sub?._id || '')

  // Get students for THIS subject only
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['subject-students', subjectId],
    queryFn: () => academicService.getStudentsBySubject(subjectId),
    enabled: !!subjectId,
  })

  // Get existing marks to pre-fill
  const { data: existingData, isLoading: loadingMarks } = useQuery({
    queryKey: ['assessment-results', assessment._id],
    queryFn: () => academicService.getAssessmentResults(assessment._id),
  })

  // Pre-fill marks once both students and existing results are loaded
  useMemo(() => {
    if (!initialized && students.length > 0 && existingData) {
      const initial: Record<string, { marks: string; absent: boolean }> = {}
      students.forEach((s: User) => {
        const existing = existingData.results.find(r => {
          const sid = r.studentId as User
          return (sid?.id || r.studentId) === s.id
        })
        initial[s.id] = {
          marks: existing && !existing.isAbsent ? String(existing.marksObtained) : '',
          absent: existing?.isAbsent || false,
        }
      })
      setMarksData(initial)
      setInitialized(true)
    }
  }, [students, existingData, initialized])

  const marksMutation = useMutation({
    mutationFn: (results: any[]) => academicService.enterMarks(assessment._id, results),
    onSuccess: (data) => {
      const errors = data?.data?.errors || []
      if (errors.length > 0) {
        toast({ title: `Saved with ${errors.length} error(s)`, description: errors[0]?.error, variant: 'destructive' })
      } else {
        toast({ title: 'Marks saved successfully', variant: 'success' })
      }
      qc.invalidateQueries({ queryKey: ['assessment-results', assessment._id] })
      qc.invalidateQueries({ queryKey: ['teacher-assessments'] })
      onSaved()
    },
    onError: (e: any) => toast({ title: 'Error', description: e.response?.data?.message, variant: 'destructive' }),
  })

  const filtered = useMemo(() => {
    if (!search) return students
    return students.filter((s: User) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.rollNumber || '').toLowerCase().includes(search.toLowerCase())
    )
  }, [students, search])

  const filledCount = Object.values(marksData).filter(v => v.marks !== '' || v.absent).length

  const submitMarks = () => {
    const results = Object.entries(marksData)
      .filter(([_, v]) => v.marks !== '' || v.absent)
      .map(([studentId, v]) => ({
        studentId,
        marksObtained: v.absent ? 0 : parseFloat(v.marks),
        isAbsent: v.absent,
      }))
    if (results.length === 0) {
      toast({ title: 'No marks to save', description: 'Enter at least one mark', variant: 'destructive' })
      return
    }
    marksMutation.mutate(results)
  }

  const isLoading = loadingStudents || loadingMarks

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-2">
        <div className="text-sm">
          <span className="font-medium">{assessment.title}</span>
          <span className="text-muted-foreground ml-2">Max: {assessment.maxMarks} marks</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {filledCount}/{students.length} filled
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or roll number..."
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Students list */}
      <div className="max-h-72 overflow-y-auto rounded-lg border">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No students found for this subject</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Student</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground w-20">Absent</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground w-28">
                  Marks (/{assessment.maxMarks})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((s: User) => (
                <tr key={s.id} className={`hover:bg-muted/30 transition-colors ${marksData[s.id]?.absent ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.rollNumber}</p>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={marksData[s.id]?.absent || false}
                      onChange={e => setMarksData(d => ({
                        ...d,
                        [s.id]: { absent: e.target.checked, marks: '' }
                      }))}
                      className="w-4 h-4 cursor-pointer accent-primary"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      max={assessment.maxMarks}
                      value={marksData[s.id]?.absent ? '' : (marksData[s.id]?.marks || '')}
                      disabled={marksData[s.id]?.absent}
                      onChange={e => setMarksData(d => ({
                        ...d,
                        [s.id]: { ...d[s.id], marks: e.target.value }
                      }))}
                      className="w-20 px-2 py-1 text-sm border rounded-lg bg-background text-center disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="—"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          {filledCount} of {students.length} students filled
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submitMarks} disabled={marksMutation.isPending || isLoading}>
            {marksMutation.isPending ? 'Saving...' : 'Save Marks'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function AssessmentsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [createDialog, setCreateDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<Assessment | null>(null)
  const [marksTarget, setMarksTarget] = useState<Assessment | null>(null)
  const [resultsTarget, setResultsTarget] = useState<Assessment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Assessment | null>(null)
  const [publishTarget, setPublishTarget] = useState<Assessment | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['teacher-assessments'],
    queryFn: () => academicService.getAssessments(),
  })

  const { data: subjects = [] } = useQuery({
    queryKey: ['teacher-subjects-list'],
    queryFn: () => teacherService.getMySubjects(),
  })

  // Filter assessments
  const filtered = useMemo(() => {
    return assessments.filter(a => {
      const matchTab = activeTab === 'all' || a.type === activeTab
      const matchSearch = !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        (a.subjectId as Subject)?.subjectName?.toLowerCase().includes(search.toLowerCase())
      return matchTab && matchSearch
    })
  }, [assessments, activeTab, search])

  // Count by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: assessments.length }
    assessments.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1 })
    return counts
  }, [assessments])

  const createMutation = useMutation({
    mutationFn: (d: any) => academicService.createAssessment(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-assessments'] })
      toast({ title: 'Assessment created', variant: 'success' })
      setCreateDialog(false)
      setForm({ ...EMPTY_FORM })
    },
    onError: (e: any) => toast({ title: 'Error', description: e.response?.data?.message, variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => academicService.updateAssessment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-assessments'] })
      toast({ title: 'Assessment updated', variant: 'success' })
      setEditTarget(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e.response?.data?.message, variant: 'destructive' }),
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => academicService.publishAssessment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-assessments'] })
      toast({ title: 'Assessment published — results visible to students', variant: 'success' })
      setPublishTarget(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e.response?.data?.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => academicService.deleteAssessment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-assessments'] })
      toast({ title: 'Assessment deleted', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e.response?.data?.message, variant: 'destructive' }),
  })

  const openEdit = (a: Assessment) => {
    const sub = a.subjectId as Subject
    setForm({
      title: a.title,
      type: a.type,
      subjectId: sub?._id || (typeof a.subjectId === 'string' ? a.subjectId : ''),
      maxMarks: String(a.maxMarks),
      assessmentDate: a.assessmentDate?.split('T')[0] || '',
      dueDate: a.dueDate?.split('T')[0] || '',
      description: a.description || '',
    })
    setEditTarget(a)
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> Assessments
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create exams, quizzes and assignments — enter and publish marks
          </p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_FORM }); setCreateDialog(true) }} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> New Assessment
        </Button>
      </div>

      {/* Type tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[['all', 'All'], ...Object.entries(TYPE_LABELS)].map(([k, v]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
              ${activeTab === k
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
            {v} {typeCounts[k] > 0 && <span className="ml-1 opacity-70">({typeCounts[k]})</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search assessments..."
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground" /></button>}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border rounded-xl">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{assessments.length === 0 ? 'No assessments yet. Create your first one.' : 'No assessments match your filter.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const sub = a.subjectId as Subject
            return (
              <div key={a._id} className="bg-card border rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{a.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[a.type]}`}>
                        {TYPE_LABELS[a.type]}
                      </span>
                      {a.isPublished
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Published</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Draft</span>
                      }
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                      <span>{sub?.subjectName || 'Unknown Subject'}</span>
                      <span>·</span>
                      <span>Max: <strong>{a.maxMarks} marks</strong></span>
                      <span>·</span>
                      <span>{formatDate(a.assessmentDate)}</span>
                      {a.dueDate && <><span>·</span><span>Due: {formatDate(a.dueDate)}</span></>}
                    </div>
                    {a.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{a.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* View Results */}
                    <Button size="sm" variant="outline" className="gap-1.5 h-8"
                      onClick={() => setResultsTarget(a)} title="View Results">
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Results</span>
                    </Button>

                    {/* Enter Marks */}
                    <Button size="sm" variant="outline" className="gap-1.5 h-8"
                      onClick={() => setMarksTarget(a)} title="Enter Marks">
                      <Users className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Marks</span>
                    </Button>

                    {/* Edit — only unpublished */}
                    {!a.isPublished && (
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                        onClick={() => openEdit(a)} title="Edit">
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {/* Publish — only draft */}
                    {!a.isPublished && (
                      <Button size="sm" variant="outline"
                        className="gap-1.5 h-8 text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => setPublishTarget(a)} title="Publish">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Publish</span>
                      </Button>
                    )}

                    {/* Export CSV */}
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                      onClick={() => academicService.exportAssessmentCSV(a._id)} title="Export CSV">
                      <Download className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete — only unpublished */}
                    {!a.isPublished && (
                      <Button size="sm" variant="outline"
                        className="h-8 w-8 p-0 text-red-500 border-red-200 hover:bg-red-50"
                        onClick={() => setDeleteTarget(a)} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CREATE DIALOG ── */}
      <Dialog open={createDialog} onOpenChange={v => { setCreateDialog(v); if (!v) setForm({ ...EMPTY_FORM }) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Assessment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Internal Exam 1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Type *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Max Marks *</label>
                <input type="number" min={1} value={form.maxMarks}
                  onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="50" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Subject *</label>
              <select value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background">
                <option value="">Select subject...</option>
                {(subjects as any[]).map((s: any) => (
                  <option key={s._id || s.id} value={s._id || s.id}>{s.subjectName} ({s.subjectCode})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Assessment Date *</label>
                <input type="date" value={form.assessmentDate}
                  onChange={e => setForm(f => ({ ...f, assessmentDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium">Due Date <span className="text-muted-foreground">(assignments)</span></label>
                <input type="date" value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ ...form, maxMarks: parseInt(form.maxMarks) })}
              disabled={createMutation.isPending || !form.title || !form.subjectId || !form.maxMarks || !form.assessmentDate}>
              {createMutation.isPending ? 'Creating...' : 'Create Assessment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT DIALOG ── */}
      <Dialog open={!!editTarget} onOpenChange={v => { if (!v) setEditTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Assessment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Max Marks *</label>
                <input type="number" min={1} value={form.maxMarks}
                  onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-sm font-medium">Assessment Date</label>
                <input type="date" value={form.assessmentDate}
                  onChange={e => setForm(f => ({ ...f, assessmentDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <input type="date" value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              onClick={() => editTarget && updateMutation.mutate({
                id: editTarget._id,
                data: { title: form.title, maxMarks: parseInt(form.maxMarks), assessmentDate: form.assessmentDate, dueDate: form.dueDate || undefined, description: form.description }
              })}
              disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MARKS DIALOG ── */}
      <Dialog open={!!marksTarget} onOpenChange={v => { if (!v) setMarksTarget(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enter Marks — {marksTarget?.title}</DialogTitle>
          </DialogHeader>
          {marksTarget && (
            <MarksEntry
              assessment={marksTarget}
              onClose={() => setMarksTarget(null)}
              onSaved={() => setMarksTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── RESULTS DIALOG ── */}
      <Dialog open={!!resultsTarget} onOpenChange={v => { if (!v) setResultsTarget(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              Results — {resultsTarget?.title}
            </DialogTitle>
          </DialogHeader>
          {resultsTarget && <ResultsView assessment={resultsTarget} onClose={() => setResultsTarget(null)} />}
        </DialogContent>
      </Dialog>

      {/* ── PUBLISH CONFIRM DIALOG ── */}
      <Dialog open={!!publishTarget} onOpenChange={v => { if (!v) setPublishTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Publish Assessment?</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              Publishing <strong>{publishTarget?.title}</strong> will make the results visible to students.
            </p>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">This action cannot be undone. Make sure all marks are entered correctly before publishing.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishTarget(null)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => publishTarget && publishMutation.mutate(publishTarget._id)}
              disabled={publishMutation.isPending}>
              {publishMutation.isPending ? 'Publishing...' : 'Yes, Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM DIALOG ── */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Assessment?</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
