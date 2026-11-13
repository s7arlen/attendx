import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, BookOpen, User } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import DataTable, { Column } from '@/components/shared/DataTable'
import ErrorState from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { adminService } from '@/services/admin.service'
import { Subject, ApiError } from '@/types'
import { toast } from '@/hooks/useToast'

const subjectSchema = z.object({
  subjectName:     z.string().min(2, 'Required'),
  subjectCode:     z.string().min(2).max(20),
  assignedTeacher: z.string().min(1, 'Select a teacher'),
  department:      z.string().min(2, 'Required'),
  year:            z.string().min(1, 'Select a year'),
  section:         z.string().min(1, 'Required'),
  credits:         z.string().optional(),
  description:     z.string().optional(),
})
type SubjectForm = z.infer<typeof subjectSchema>

export default function SubjectsPage() {
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [editTarget, setEditTarget]     = useState<Subject | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)
  const [search, setSearch]             = useState('')
  const queryClient = useQueryClient()

  const { data: subjects = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-subjects', search],
    queryFn: () => search.trim() ? adminService.searchSubjects({ q: search }) : adminService.getSubjects(),
  })

  const { data: teachersData } = useQuery({
    queryKey: ['admin-teachers-all'],
    queryFn: () => adminService.getTeachers({ limit: 100 }),
  })
  const teachers = teachersData?.teachers || []

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
  })

  const createMutation = useMutation({
    mutationFn: (d: SubjectForm) => adminService.createSubject({
      ...d,
      year: parseInt(d.year),
      credits: (d.credits !== undefined && d.credits !== '') ? parseInt(d.credits) : 3,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-subjects'] }); toast({ title: 'Subject created', variant: 'success' }); setDialogOpen(false); reset() },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Error', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubjectForm }) => adminService.updateSubject(id, {
      ...data,
      year: parseInt(data.year),
      credits: (data.credits !== undefined && data.credits !== '') ? parseInt(data.credits) : 3,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-subjects'] }); toast({ title: 'Subject updated', variant: 'success' }); setDialogOpen(false) },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Update failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const deleteMutation = useMutation({
    mutationFn: adminService.deleteSubject,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-subjects'] }); toast({ title: 'Subject deactivated', variant: 'success' }); setDeleteTarget(null) },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const hardDeleteMutation = useMutation({
    mutationFn: adminService.hardDeleteSubject,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-subjects'] }); toast({ title: 'Subject permanently deleted', variant: 'success' }); setDeleteTarget(null) },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const onSubmit = (d: SubjectForm) => {
    if (editTarget) updateMutation.mutate({ id: editTarget._id, data: d })
    else createMutation.mutate(d)
  }

  const openEdit = (subject: Subject) => {
    setEditTarget(subject)
    reset({
      subjectName:     subject.subjectName,
      subjectCode:     subject.subjectCode,
      assignedTeacher: typeof subject.assignedTeacher === 'string' ? subject.assignedTeacher : String((subject.assignedTeacher as unknown as Record<string, unknown>)._id),
      department:      subject.department,
      year:            String(subject.year),
      section:         subject.section,
      credits:         String(subject.credits),
      description:     subject.description ?? '',
    })
    setDialogOpen(true)
  }

  const columns: Column<Subject>[] = [
    {
      key: 'subjectName', label: 'Subject',
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center" aria-hidden="true">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{s.subjectName}</p>
            <p className="text-xs text-muted-foreground font-mono">{s.subjectCode}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'assignedTeacher', label: 'Teacher',
      render: (s) => (
        <div className="flex items-center gap-1.5 text-sm">
          <User className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
          {(s.assignedTeacher as unknown as Record<string, unknown>)?.name as React.ReactNode || '—'}
        </div>
      ),
    },
    {
      key: 'department', label: 'Dept / Year / Sec',
      render: (s) => (
        <div className="text-sm">
          <p>{s.department}</p>
          <p className="text-xs text-muted-foreground">Year {s.year} · Sec {s.section}</p>
        </div>
      ),
    },
    { key: 'credits', label: 'Credits', render: (s) => <Badge variant="blue">{s.credits} cr</Badge> },
    { key: 'isActive', label: 'Status', render: (s) => <Badge variant={s.isActive ? 'success' : 'error'}>{s.isActive ? 'Active' : 'Inactive'}</Badge> },
  ]

  if (isError) return <ErrorState message="Could not load subjects." onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div>
            <h2 className="text-xl font-bold">Subjects</h2>
            <p className="text-sm text-muted-foreground">{subjects.length} total subjects</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              className="h-9 rounded-xl border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-52"
              placeholder="Search subjects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search subjects"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <Button onClick={() => { setEditTarget(null); reset({}); setDialogOpen(true) }} variant="gradient">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Subject
          </Button>
        </div>
      </div>

      <DataTable
        data={subjects}
        columns={columns}
        loading={isLoading}
        emptyMessage="No subjects found"
        caption="Subjects list"
        actions={(subject) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${subject.subjectName}`} onClick={() => openEdit(subject)}>
              <Edit className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost" size="icon-sm"
              aria-label={`Remove ${subject.subjectName}`}
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteTarget(subject)}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          </>
        )}
      />

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? 'Edit Subject' : 'Add New Subject'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="sj-name">Subject Name</Label>
                <Input id="sj-name" {...register('subjectName')} placeholder="Data Structures & Algorithms" />
                {errors.subjectName && <p className="text-xs text-destructive" role="alert">{errors.subjectName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sj-code">Subject Code</Label>
                <Input id="sj-code" {...register('subjectCode')} placeholder="CS301" className="uppercase" />
                {errors.subjectCode && <p className="text-xs text-destructive" role="alert">{errors.subjectCode.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sj-credits">Credits</Label>
                <Input id="sj-credits" {...register('credits')} type="number" placeholder="3" min={1} max={6} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="sj-teacher">Assign Teacher</Label>
                <Controller
                  name="assignedTeacher"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger id="sj-teacher"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                      <SelectContent>
                        {teachers.map((t: { id: string; _id?: string; name: string; department: string }) => (
                          <SelectItem key={t.id ?? t._id} value={t.id ?? t._id ?? ''}>{t.name} — {t.department}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.assignedTeacher && <p className="text-xs text-destructive" role="alert">{errors.assignedTeacher.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="sj-dept">Department</Label>
                <Input id="sj-dept" {...register('department')} placeholder="Computer Science" />
                {errors.department && <p className="text-xs text-destructive" role="alert">{errors.department.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sj-year">Year</Label>
                <Controller
                  name="year"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger id="sj-year"><SelectValue placeholder="Select year" /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.year && <p className="text-xs text-destructive" role="alert">{errors.year.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sj-sec">Section</Label>
                <Input id="sj-sec" {...register('section')} placeholder="A" />
                {errors.section && <p className="text-xs text-destructive" role="alert">{errors.section.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="sj-desc">Description (optional)</Label>
                <Input id="sj-desc" {...register('description')} placeholder="Brief description..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gradient" loading={createMutation.isPending || updateMutation.isPending}>
                {editTarget ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Subject</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            What would you like to do with{' '}
            <span className="font-semibold text-foreground">{deleteTarget?.subjectName}</span>{' '}
            <span className="font-mono text-xs">({deleteTarget?.subjectCode})</span>?
          </p>
          <div className="grid gap-3 mt-1">
            <div className="rounded-lg border border-border p-3 space-y-1">
              <p className="text-sm font-medium">Deactivate</p>
              <p className="text-xs text-muted-foreground">Hides subject but preserves attendance records. Reversible.</p>
              <Button
                variant="outline" size="sm"
                className="w-full mt-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
                loading={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
              >Deactivate Subject</Button>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              <p className="text-sm font-medium text-destructive">Delete Permanently</p>
              <p className="text-xs text-muted-foreground">
                Removes from database. <span className="font-semibold text-foreground">Cannot be undone.</span>
              </p>
              <Button variant="destructive" size="sm" className="w-full mt-2"
                loading={hardDeleteMutation.isPending}
                onClick={() => deleteTarget && hardDeleteMutation.mutate(deleteTarget._id)}
              >Delete Permanently</Button>
            </div>
          </div>
          <DialogFooter className="mt-1">
            <Button variant="ghost" className="w-full" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
