import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Phone, Building2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import DataTable, { Column } from '@/components/shared/DataTable'
import ErrorState from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { adminService } from '@/services/admin.service'
import { User, ApiError } from '@/types'
import { formatDate, generateAvatarUrl } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

const teacherSchema = z.object({
  name:       z.string().min(2, 'Min 2 characters'),
  email:      z.string().email('Enter a valid email'),
  password:   z.string().min(8, 'Min 8 characters').optional(),
  department: z.string().min(2, 'Department required'),
  phone:      z.string().optional(),
})
type TeacherForm = z.infer<typeof teacherSchema>

export default function TeachersPage() {
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [editTarget, setEditTarget]     = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const queryClient = useQueryClient()
  const limit = 20

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-teachers', search, page],
    queryFn: () => adminService.getTeachers({ search, page, limit }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
  })

  const createMutation = useMutation({
    mutationFn: (d: TeacherForm) => adminService.createTeacher({ ...d, password: d.password || '' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-teachers'] }); toast({ title: 'Teacher created', variant: 'success' }); setDialogOpen(false); reset() },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Error', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) => adminService.updateTeacher(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-teachers'] }); toast({ title: 'Teacher updated', variant: 'success' }); setDialogOpen(false); setEditTarget(null); reset() },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Update failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const deleteMutation = useMutation({
    mutationFn: adminService.deleteTeacher,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-teachers'] }); toast({ title: 'Teacher deactivated', description: 'Data preserved. Login access removed.', variant: 'success' }); setDeleteTarget(null) },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const activateMutation = useMutation({
    mutationFn: adminService.activateTeacher,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-teachers'] }); toast({ title: 'Teacher activated', description: 'Login access restored.', variant: 'success' }); setDeleteTarget(null) },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const hardDeleteMutation = useMutation({
    mutationFn: adminService.hardDeleteTeacher,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-teachers'] }); toast({ title: 'Teacher permanently deleted', variant: 'success' }); setDeleteTarget(null) },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const onSubmit = (d: TeacherForm) => {
    if (editTarget) updateMutation.mutate({ id: editTarget.id, data: d })
    else createMutation.mutate(d)
  }

  const openEdit = (teacher: User) => {
    setEditTarget({ ...teacher, id: String((teacher as User & { _id?: string })._id ?? teacher.id) })
    reset({ name: teacher.name, email: teacher.email, department: teacher.department, phone: teacher.phone })
    setDialogOpen(true)
  }

  const columns: Column<User>[] = [
    {
      key: 'name', label: 'Teacher',
      render: (t) => (
        <div className="flex items-center gap-3">
          <img src={t.avatar || generateAvatarUrl(t.name)} alt="" aria-hidden="true" className="w-8 h-8 rounded-full" />
          <div>
            <p className="font-medium text-sm">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department', label: 'Department',
      render: (t) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
          {t.department}
        </div>
      ),
    },
    {
      key: 'phone', label: 'Contact',
      render: (t) => t.phone ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Phone className="w-3.5 h-3.5" aria-hidden="true" />
          {t.phone}
        </div>
      ) : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'isActive', label: 'Status',
      render: (t) => <Badge variant={t.isActive ? 'success' : 'error'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'createdAt', label: 'Joined',
      render: (t) => <span className="text-xs text-muted-foreground">{t.createdAt ? formatDate(t.createdAt) : '—'}</span>,
    },
  ]

  const teachers = data?.teachers || []
  const total    = data?.total    || 0

  if (isError) return <ErrorState message="Could not load teachers." onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Teachers</h2>
          <p className="text-sm text-muted-foreground">{total} total teachers</p>
        </div>
        <Button onClick={() => { setEditTarget(null); reset({}); setDialogOpen(true) }} variant="gradient">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Teacher
        </Button>
      </div>

      <DataTable
        data={teachers.map((t: User & { _id?: string }) => ({ ...t, id: String(t._id ?? t.id) }))}
        columns={columns}
        searchPlaceholder="Search teachers..."
        onSearch={(v) => { setSearch(v); setPage(1) }}
        searchValue={search}
        page={page}
        totalPages={Math.ceil(total / limit)}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No teachers found"
        caption="Teachers list"
        actions={(teacher) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${teacher.name}`} onClick={() => openEdit(teacher)}>
              <Edit className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost" size="icon-sm"
              aria-label={`Remove ${teacher.name}`}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteTarget(teacher)}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          </>
        )}
      />

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTarget ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Full Name</Label>
              <Input id="t-name" {...register('name')} placeholder="Dr. Jane Smith" />
              {errors.name && <p className="text-xs text-destructive" role="alert">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-email">Email</Label>
              <Input id="t-email" {...register('email')} type="email" placeholder="teacher@university.edu" />
              {errors.email && <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>}
            </div>
            {!editTarget && (
              <div className="space-y-1.5">
                <Label htmlFor="t-pass">Password</Label>
                <Input id="t-pass" {...register('password')} type="password" placeholder="Min 8 characters" />
                {errors.password && <p className="text-xs text-destructive" role="alert">{errors.password.message}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="t-dept">Department</Label>
              <Input id="t-dept" {...register('department')} placeholder="Computer Science" />
              {errors.department && <p className="text-xs text-destructive" role="alert">{errors.department.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-phone">Phone (optional)</Label>
              <Input id="t-phone" {...register('phone')} placeholder="+1 234 567 8900" />
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
          <DialogHeader><DialogTitle>Manage Teacher</DialogTitle></DialogHeader>
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
              <Button variant="destructive" size="sm" className="w-full mt-2"
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
