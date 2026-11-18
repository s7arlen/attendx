import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, BookOpen, Users, CheckCircle, Edit, Eye } from 'lucide-react'
import { academicService } from '@/services/academic.service'
import { adminService } from '@/services/admin.service'
import { Assessment, AssessmentType, Subject, User } from '@/types'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/useToast'

const TYPE_LABELS: Record<AssessmentType, string> = {
  internal_exam: 'Internal Exam', unit_test: 'Unit Test', quiz: 'Quiz',
  assignment: 'Assignment', practical: 'Practical', project: 'Project', other: 'Other',
}

export default function AssessmentsPage() {
  const qc = useQueryClient()
  const [createDialog, setCreateDialog] = useState(false)
  const [marksDialog, setMarksDialog] = useState<Assessment | null>(null)
  const [form, setForm] = useState({ title: '', type: 'internal_exam', subjectId: '', maxMarks: '', assessmentDate: '', description: '' })
  const [marksData, setMarksData] = useState<Record<string, { marks: string; absent: boolean }>>({})

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['teacher-assessments'],
    queryFn: () => academicService.getAssessments(),
  })

  const { data: subjects = [] } = useQuery({
    queryKey: ['teacher-subjects-list'],
    queryFn: () => import('@/services/teacher.service').then(m => m.teacherService.getMySubjects()),
  })

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-marks', marksDialog?._id],
    queryFn: async () => {
      if (!marksDialog) return []
      const res = await academicService.getAssessmentResults(marksDialog._id)
      return res
    },
    enabled: !!marksDialog,
  })

  const { data: allStudents = [] } = useQuery({
    queryKey: ['all-students-marks'],
    queryFn: async () => {
      const res = await import('@/services/admin.service').then(m => m.adminService.getStudents({ limit: 100 }))
      return res.students || []
    },
    enabled: !!marksDialog,
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => academicService.createAssessment(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teacher-assessments'] }); toast({ title: 'Assessment created', variant: 'success' }); setCreateDialog(false); setForm({ title: '', type: 'internal_exam', subjectId: '', maxMarks: '', assessmentDate: '', description: '' }) },
    onError: (e: any) => toast({ title: 'Error', description: e.response?.data?.message, variant: 'destructive' }),
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => academicService.publishAssessment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teacher-assessments'] }); toast({ title: 'Published', variant: 'success' }) },
  })

  const marksMutation = useMutation({
    mutationFn: ({ id, results }: { id: string; results: any[] }) => academicService.enterMarks(id, results),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teacher-assessments'] }); toast({ title: 'Marks saved', variant: 'success' }); setMarksDialog(null); setMarksData({}) },
    onError: (e: any) => toast({ title: 'Error', description: e.response?.data?.message, variant: 'destructive' }),
  })

  const openMarksDialog = (assessment: Assessment) => {
    setMarksDialog(assessment)
    const initial: Record<string, { marks: string; absent: boolean }> = {}
    allStudents.forEach((s: User) => { initial[s.id] = { marks: '', absent: false } })
    setMarksData(initial)
  }

  const submitMarks = () => {
    if (!marksDialog) return
    const results = Object.entries(marksData)
      .filter(([_, v]) => v.marks !== '' || v.absent)
      .map(([studentId, v]) => ({
        studentId,
        marksObtained: v.absent ? 0 : parseFloat(v.marks),
        isAbsent: v.absent,
      }))
    marksMutation.mutate({ id: marksDialog._id, results })
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-primary" /> Assessments</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage internal exams, quizzes and assignments</p>
        </div>
        <Button onClick={() => setCreateDialog(true)} className="gap-2"><Plus className="w-4 h-4" /> New Assessment</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : assessments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No assessments yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {assessments.map(a => {
            const sub = a.subjectId as Subject
            return (
              <div key={a._id} className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{a.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{TYPE_LABELS[a.type]}</span>
                    {a.isPublished
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Published</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Draft</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {sub?.subjectName || 'Unknown Subject'} · Max: {a.maxMarks} marks · {formatDate(a.assessmentDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openMarksDialog(a)}>
                    <Users className="w-3.5 h-3.5" /> Enter Marks
                  </Button>
                  {!a.isPublished && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-green-600 border-green-200" onClick={() => publishMutation.mutate(a._id)}>
                      <CheckCircle className="w-3.5 h-3.5" /> Publish
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Assessment Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Assessment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background" placeholder="e.g. Internal Exam 1" />
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
                <input type="number" value={form.maxMarks} onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background" placeholder="50" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Subject *</label>
              <select value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background">
                <option value="">Select subject</option>
                {(subjects as any[]).map((s: any) => <option key={s._id || s.id} value={s._id || s.id}>{s.subjectName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Date *</label>
              <input type="date" value={form.assessmentDate} onChange={e => setForm(f => ({ ...f, assessmentDate: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate({ ...form, maxMarks: parseInt(form.maxMarks) })}
              disabled={createMutation.isPending || !form.title || !form.subjectId || !form.maxMarks || !form.assessmentDate}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Marks Entry Dialog */}
      <Dialog open={!!marksDialog} onOpenChange={() => setMarksDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Enter Marks — {marksDialog?.title}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground mb-3">Max marks: {marksDialog?.maxMarks}</div>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {allStudents.map((s: User) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.rollNumber}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={marksData[s.id]?.absent || false}
                      onChange={e => setMarksData(d => ({ ...d, [s.id]: { ...d[s.id], absent: e.target.checked, marks: '' } }))} />
                    Absent
                  </label>
                  <input type="number" min={0} max={marksDialog?.maxMarks}
                    value={marksData[s.id]?.absent ? '' : (marksData[s.id]?.marks || '')}
                    disabled={marksData[s.id]?.absent}
                    onChange={e => setMarksData(d => ({ ...d, [s.id]: { ...d[s.id], marks: e.target.value } }))}
                    className="w-20 px-2 py-1 text-sm border rounded-lg bg-background disabled:opacity-40" placeholder="Marks" />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarksDialog(null)}>Cancel</Button>
            <Button onClick={submitMarks} disabled={marksMutation.isPending}>Save Marks</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
