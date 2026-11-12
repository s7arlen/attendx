import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Hash, Search, Filter } from 'lucide-react'
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
import { User, ApiError } from '@/types'
import { formatDate, generateAvatarUrl } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { USN_REGEX } from '@/lib/usn'

const studentSchema = z.object({
  name:        z.string().min(2, 'Min 2 characters'),
  email:       z.string().email('Enter a valid email'),
  password:    z.string().min(8, 'Min 8 characters').optional(),
  department:  z.string().min(2, 'Department required'),
  year:        z.string().optional(),
  section:     z.string().optional(),
  rollNumber:  z.string()
    .optional()
    .refine(v => !v || USN_REGEX.test(v.toUpperCase()), {
      message: 'USN must be in format 4CB25CS001',
    }),
  phone:       z.string().optional(),
})
type StudentForm = z.infer<typeof studentSchema>

export default function StudentsPage() {
  const [search, setSearch]           = useState('')
  const [deptFilter, setDeptFilter]   = useState('')
  const [yearFilter, setYearFilter]   = useState('')
  const [secFilter, setSecFilter]     = useState('')
  const [page, setPage]               = useState(1)
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [editTarget, setEditTarget]   = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const queryClient = useQueryClient()
  const limit = 20

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-students', search, page, deptFilter, yearFilter, secFilter],
    queryFn: () => adminService.getStudents({
      search, page, limit,
      department: deptFilter || undefined,
      year: yearFilter ? parseInt(yearFilter) : undefined,
      section: secFilter || undefined,
    }),
  })

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
  })

  const createMutation = useMutation({
    mutationFn: (d: StudentForm) => adminService.createStudent({ ...d, year: d.year ? parseInt(d.year) : undefined, password: d.password || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      toast({ title: 'Student created', variant: 'success' })
      setDialogOpen(false); reset()
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Error', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StudentForm }) =>
      adminService.updateStudent(id, { ...data, year: data.year ? parseInt(data.year) : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      toast({ title: 'Student updated', variant: 'success' })
      setDialogOpen(false); reset()
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Update failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const deleteMutation = useMutation({
    mutationFn: adminService.deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      toast({ title: 'Student deactivated', description: 'Data preserved. Login access removed.', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const activateMutation = useMutation({
    mutationFn: adminService.activateStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      toast({ title: 'Student activated', description: 'Login access restored.', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const hardDeleteMutation = useMutation({
    mutationFn: adminService.hardDeleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      toast({ title: 'Student permanently deleted', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const onSubmit = (d: StudentForm) => {
    if (editTarget) updateMutation.mutate({ id: editTarget.id, data: d })
    else createMutation.mutate(d)
  }

  const openEdit = (student: User) => {
    const id = String((student as User & { _id?: string })._id ?? student.id)
    setEditTarget({ ...student, id })
    reset({
      name:       student.name,
      email:      student.email,
      department: student.department,
      year:       student.year?.toString() ?? '',
      section:    student.section ?? '',
      rollNumber: student.rollNumber ?? '',
      phone:      student.phone ?? '',
    })
    setDialogOpen(true)
  }

  const columns: Column<User>[] = [
    {
      key: 'name', label: 'Student',
      render: (s) => (
        <div className="flex items-center gap-3">
          <img src={s.avatar || generateAvatarUrl(s.name)} alt="" aria-hidden="true" className="w-8 h-8 rounded-full" />
          <div>
            <p className="font-medium text-sm">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'rollNumber', label: 'Roll No.',
      render: (s) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Hash className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
          {s.rollNumber || '—'}
        </div>
      ),
    },
    {
      key: 'department', label: 'Dept / Year',
      render: (s) => (
        <div>
          <p className="text-sm">{s.department}</p>
          <p className="text-xs text-muted-foreground">Year {s.year} · Sec {s.section}</p>
        </div>
      ),
    },
    {
      key: 'isActive', label: 'Status',
      render: (s) => <Badge variant={s.isActive ? 'success' : 'error'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'createdAt', label: 'Joined',
      render: (s) => <span className="text-xs text-muted-foreground">{s.createdAt ? formatDate(s.createdAt) : '—'}</span>,
    },
  ]

  const students = data?.students || []
  const total    = data?.total    || 0

  if (isError) return <ErrorState message="Could not load students." onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Students</h2>
          <p className="text-sm text-muted-foreground">{total} total students</p>
        </div>
        <Button onClick={() => { setEditTarget(null); reset({}); setDialogOpen(true) }} variant="gradient">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Student
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            className="w-full h-10 rounded-xl border border-input bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search students..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        {/* Department */}
        <input
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-40"
          placeholder="Department…"
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setPage(1) }}
        />
        {/* Year */}
        <select
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Years</option>
          {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>
        {/* Section */}
        <input
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-24"
          placeholder="Section…"
          value={secFilter}
          onChange={(e) => { setSecFilter(e.target.value.toUpperCase()); setPage(1) }}
          maxLength={2}
        />
        {/* Reset */}
        {(deptFilter || yearFilter || secFilter) && (
          <button
            onClick={() => { setDeptFilter(''); setYearFilter(''); setSecFilter(''); setPage(1) }}
            className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        data={students.map((s: User & { _id?: string }) => ({ ...s, id: String(s._id ?? s.id) }))}
        columns={columns}
        page={page}
        totalPages={Math.ceil(total / limit)}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No students found"
        caption="Students list"
        actions={(student) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${student.name}`} onClick={() => openEdit(student)}>
              <Edit className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost" size="icon-sm"
              aria-label={`Remove ${student.name}`}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteTarget(student)}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          </>
        )}
      />

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Student' : 'Add New Student'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-name">Full Name</Label>
                <Input id="s-name" {...register('name')} placeholder="John Doe" />
                {errors.name && <p className="text-xs text-destructive" role="alert">{errors.name.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-email">Email</Label>
                <Input id="s-email" {...register('email')} type="email" placeholder="student@university.edu" />
                {errors.email && <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>}
              </div>
              {!editTarget && (
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="s-pass">Password</Label>
                  <Input id="s-pass" {...register('password')} type="password" placeholder="Min 8 characters" />
                  {errors.password && <p className="text-xs text-destructive" role="alert">{errors.password.message}</p>}
                </div>
              )}
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-dept">Department</Label>
                <Input id="s-dept" {...register('department')} placeholder="Computer Science" />
                {errors.department && <p className="text-xs text-destructive" role="alert">{errors.department.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-year">Year</Label>
                {/* Controller so current value shows on edit */}
                <Controller
                  name="year"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger id="s-year"><SelectValue placeholder="Select year" /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map(y => (
                          <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-sec">Section</Label>
                <Input id="s-sec" {...register('section')} placeholder="A" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-roll">USN / Roll Number</Label>
                <Controller
                  name="rollNumber"
                  control={control}
                  render={({ field }) => {
                    const isValid = !field.value || USN_REGEX.test(field.value.toUpperCase())
                    return (
                      <div className="space-y-1">
                        <Input
                          id="s-roll"
                          placeholder="4CB25CS001"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                          maxLength={12}
                          className={`font-mono uppercase tracking-widest ${
                            field.value && !isValid ? 'border-destructive focus:border-destructive' : ''
                          }`}
                          aria-describedby="usn-hint"
                        />
                        <p id="usn-hint" className={`text-xs ${
                          field.value
                            ? isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                            : 'text-muted-foreground'
                        }`}>
                          {field.value
                            ? isValid
                              ? `✓ Valid USN: ${field.value}`
                              : 'Format: 4CB + year(2) + branch(CS/AI/IS/CG/EC/ME/CV/EE) + roll(3) — e.g. 4CB25CS001'
                            : 'Format: 4CB25CS001 — year · branch · roll number'
                          }
                        </p>
                      </div>
                    )
                  }}
                />
                {errors.rollNumber && <p className="text-xs text-destructive" role="alert">{errors.rollNumber.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-phone">Phone</Label>
                <Input id="s-phone" {...register('phone')} placeholder="+1 234 567" />
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

      {/* Delete / Activate dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Manage Student</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Choose an action for{' '}
            <span className="font-semibold text-foreground">{deleteTarget?.name}</span>
            {' '}(currently{' '}
            <span className={deleteTarget?.isActive ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
              {deleteTarget?.isActive ? 'Active' : 'Inactive'}
            </span>
            ).
          </p>
          <div className="grid gap-3 mt-1">
            {/* Activate — only shown when inactive */}
            {deleteTarget && !deleteTarget.isActive && (
              <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-500/5 p-3 space-y-1">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Activate</p>
                <p className="text-xs text-muted-foreground">Restores login access. All data remains intact.</p>
                <Button
                  variant="outline" size="sm"
                  className="w-full mt-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                  loading={activateMutation.isPending}
                  onClick={() => deleteTarget && activateMutation.mutate(deleteTarget.id)}
                >Activate Account</Button>
              </div>
            )}

            {/* Deactivate — only shown when active */}
            {deleteTarget?.isActive && (
              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-sm font-medium">Deactivate</p>
                <p className="text-xs text-muted-foreground">Blocks login but preserves all data. Reversible.</p>
                <Button
                  variant="outline" size="sm"
                  className="w-full mt-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
                  loading={deleteMutation.isPending}
                  onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                >Deactivate Account</Button>
              </div>
            )}

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              <p className="text-sm font-medium text-destructive">Delete Permanently</p>
              <p className="text-xs text-muted-foreground">
                Removes from database. <span className="font-semibold text-foreground">Cannot be undone.</span>
              </p>
              <Button
                variant="destructive" size="sm" className="w-full mt-2"
                loading={hardDeleteMutation.isPending}
                onClick={() => deleteTarget && hardDeleteMutation.mutate(deleteTarget.id)}
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
