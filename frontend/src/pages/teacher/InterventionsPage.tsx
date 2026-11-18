import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ClipboardList, CheckCircle, Clock, XCircle, Edit } from 'lucide-react'
import { academicService } from '@/services/academic.service'
import { adminService } from '@/services/admin.service'
import { Intervention, InterventionStatus, User } from '@/types'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/useToast'

const STATUS_CONFIG: Record<InterventionStatus, { label: string; color: string; icon: any }> = {
  pending:     { label: 'Pending',     color: 'bg-slate-100 text-slate-700',  icon: Clock },
  scheduled:   { label: 'Scheduled',   color: 'bg-blue-100 text-blue-700',    icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700',  icon: Clock },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  cancelled:   { label: 'Cancelled',   color: 'bg-red-100 text-red-700',      icon: XCircle },
}

const TYPE_LABELS: Record<string, string> = {
  counselling: 'Counselling', mentoring: 'Mentoring', remedial_class: 'Remedial Class',
  subject_support: 'Subject Support', assignment_help: 'Assignment Help',
  parent_meeting: 'Parent Meeting', other: 'Other',
}

export default function InterventionsPage() {
  const qc = useQueryClient()
  const [createDialog, setCreateDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<Intervention | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [form, setForm] = useState({ studentId: '', type: 'mentoring', description: '', scheduledDate: '', followUpDate: '', notes: '' })

  const { data: interventions = [], isLoading } = useQuery({
    queryKey: ['interventions', filterStatus],
    queryFn: () => academicService.getInterventions({ status: filterStatus || undefined }),
  })

  const { data: studentsData } = useQuery({
    queryKey: ['students-list'],
    queryFn: () => adminService.getStudents({ limit: 100 }),
  })
  const students: User[] = studentsData?.students || []

  const createMutation = useMutation({
    mutationFn: (d: any) => academicService.createIntervention(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['interventions'] }); toast({ title: 'Intervention created', variant: 'success' }); setCreateDialog(false); setForm({ studentId: '', type: 'mentoring', description: '', scheduledDate: '', followUpDate: '', notes: '' }) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => academicService.updateIntervention(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['interventions'] }); toast({ title: 'Updated', variant: 'success' }); setEditTarget(null) },
  })

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="w-6 h-6 text-primary" /> Interventions</h1>
          <p className="text-sm text-muted-foreground mt-1">Track academic support and mentoring sessions</p>
        </div>
        <Button onClick={() => setCreateDialog(true)} className="gap-2"><Plus className="w-4 h-4" /> New Intervention</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = interventions.filter((i: Intervention) => i.status === status).length
          return (
            <button key={status} onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
              className={`border rounded-xl p-3 text-center transition-all ${filterStatus === status ? 'ring-2 ring-primary' : ''}`}>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cfg.label}</p>
            </button>
          )
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : interventions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card border rounded-xl">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No interventions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {interventions.map((inv: Intervention) => {
            const student = inv.studentId as User
            const cfg = STATUS_CONFIG[inv.status]
            return (
              <div key={inv._id} className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{student?.name || 'Unknown Student'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{TYPE_LABELS[inv.type]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    {inv.riskLevelAtCreation && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${inv.riskLevelAtCreation === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' : inv.riskLevelAtCreation === 'MODERATE' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        Risk at creation: {inv.riskLevelAtCreation}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{inv.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">Scheduled: {formatDate(inv.scheduledDate)} {inv.followUpDate && `· Follow-up: ${formatDate(inv.followUpDate)}`}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setEditTarget(inv)}>
                  <Edit className="w-3.5 h-3.5" /> Update
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Intervention</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Student *</label>
              <select value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background">
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.rollNumber}</option>)}
              </select>
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
                <label className="text-sm font-medium">Scheduled Date *</label>
                <input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none" />
            </div>
            <div>
              <label className="text-sm font-medium">Follow-up Date</label>
              <input type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background" />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.studentId || !form.description || !form.scheduledDate}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Update Intervention</DialogTitle></DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Status</label>
                <select defaultValue={editTarget.status}
                  onChange={e => setEditTarget(t => t ? { ...t, status: e.target.value as InterventionStatus } : null)}
                  className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Outcome</label>
                <textarea defaultValue={editTarget.outcome || ''}
                  onChange={e => setEditTarget(t => t ? { ...t, outcome: e.target.value } : null)}
                  rows={3} className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none" placeholder="Describe the outcome..." />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea defaultValue={editTarget.notes || ''}
                  onChange={e => setEditTarget(t => t ? { ...t, notes: e.target.value } : null)}
                  rows={2} className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={() => editTarget && updateMutation.mutate({ id: editTarget._id, data: { status: editTarget.status, outcome: editTarget.outcome, notes: editTarget.notes } })}
              disabled={updateMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
