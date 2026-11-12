import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Clock, MapPin, Calendar, Edit } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { adminService } from '@/services/admin.service'
import { Timetable, ApiError } from '@/types'
import { toast } from '@/hooks/useToast'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const timetableSchema = z.object({
  subjectId: z.string().min(1, 'Subject required'),
  teacherId: z.string().min(1, 'Teacher required'),
  day: z.enum(DAYS),
  startTime: z.string().min(1, 'Start time required'),
  endTime: z.string().min(1, 'End time required'),
  room: z.string().optional(),
})
type TimetableForm = z.infer<typeof timetableSchema>

const dayColors: Record<string, string> = {
  Monday: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Tuesday: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Wednesday: 'bg-green-500/10 text-green-600 dark:text-green-400',
  Thursday: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Friday: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  Saturday: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
}

export default function TimetablePage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Timetable | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>('all')
  const queryClient = useQueryClient()

  const { data: timetables = [], isLoading } = useQuery({
    queryKey: ['admin-timetables'],
    queryFn: adminService.getTimetables,
  })

  const { data: subjectsData } = useQuery({
    queryKey: ['admin-subjects-all'],
    queryFn: adminService.getSubjects,
  })

  const { data: teachersData } = useQuery({
    queryKey: ['admin-teachers-all'],
    queryFn: () => adminService.getTeachers({ page: 1, limit: 100 }),
  })

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<TimetableForm>({
    resolver: zodResolver(timetableSchema),
    defaultValues: { day: 'Monday' },
  })

  const openCreate = () => {
    setEditTarget(null)
    reset({ day: 'Monday', subjectId: '', teacherId: '', startTime: '', endTime: '', room: '' })
    setDialogOpen(true)
  }

  const openEdit = (entry: Timetable) => {
    setEditTarget(entry)
    reset({
      subjectId: typeof entry.subjectId === 'object' ? String((entry.subjectId as unknown as Record<string, unknown>)._id) : entry.subjectId,
      teacherId: typeof entry.teacherId === 'object' ? String((entry.teacherId as unknown as Record<string, unknown>)._id) : entry.teacherId,
      day:       entry.day,
      startTime: entry.startTime,
      endTime:   entry.endTime,
      room:      entry.room ?? '',
    })
    setDialogOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: adminService.createTimetable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timetables'] })
      toast({ title: 'Timetable entry added', variant: 'success' })
      setDialogOpen(false); reset()
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Error', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TimetableForm }) => adminService.updateTimetable(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timetables'] })
      toast({ title: 'Timetable entry updated', variant: 'success' })
      setDialogOpen(false); setEditTarget(null); reset()
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Update failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const deleteMutation = useMutation({
    mutationFn: adminService.deleteTimetable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timetables'] })
      toast({ title: 'Timetable entry removed', variant: 'success' })
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Delete failed', description: error.response?.data?.message, variant: 'destructive' });
    },
  })

  const onSubmit = (d: TimetableForm) => {
    if (editTarget) updateMutation.mutate({ id: editTarget._id, data: d })
    else createMutation.mutate(d)
  }

  const subjects = subjectsData || []
  const teachers = teachersData?.teachers || []

  const filtered = selectedDay === 'all'
    ? timetables
    : timetables.filter((t: Timetable) => t.day === selectedDay)

  const grouped = DAYS.reduce((acc, day) => {
    acc[day] = filtered.filter((t: Timetable) => t.day === day)
    return acc
  }, {} as Record<string, Timetable[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Timetable Management</h2>
          <p className="text-sm text-muted-foreground">{timetables.length} total entries</p>
        </div>
        <Button onClick={openCreate} variant="gradient">
          <Plus className="w-4 h-4" />
          Add Entry
        </Button>
      </div>

      {/* Day filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedDay('all')}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${selectedDay === 'all' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          All Days
        </button>
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${selectedDay === day ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid gap-4">
          {DAYS.filter(day => selectedDay === 'all' || selectedDay === day).map(day => (
            grouped[day]?.length > 0 ? (
              <Card key={day}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className={`px-2.5 py-1 rounded-lg text-sm font-medium ${dayColors[day]}`}>{day}</span>
                    <span className="text-muted-foreground font-normal text-sm">({grouped[day].length} classes)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((entry: Timetable) => {
                      const subject = typeof entry.subjectId === 'object' ? entry.subjectId : null
                      const teacher = typeof entry.teacherId === 'object' ? entry.teacherId : null
                      return (
                        <motion.div
                          key={entry._id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between p-3 bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-sm font-medium min-w-[90px]">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              {entry.startTime} – {entry.endTime}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {(subject as unknown as Record<string, unknown>)?.subjectName as React.ReactNode || 'Unknown Subject'}
                                <span className="ml-2 text-xs font-mono text-muted-foreground">
                                  {(subject as unknown as Record<string, unknown>)?.subjectCode as React.ReactNode}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">{(teacher as unknown as Record<string, unknown>)?.name as React.ReactNode || 'Unknown Teacher'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.room && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {entry.room}
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Edit timetable entry"
                              className="opacity-0 group-hover:opacity-100"
                              onClick={(e) => { e.stopPropagation(); openEdit(entry) }}
                            >
                              <Edit className="w-4 h-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove timetable entry"
                              className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteMutation.mutate(entry._id)}
                              loading={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : null
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No timetable entries for {selectedDay === 'all' ? 'any day' : selectedDay}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                Add first entry
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditTarget(null); reset() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Timetable Entry' : 'Add Timetable Entry'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Controller name="subjectId" control={control} render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select subject..." /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s: { _id?: string; id?: string; subjectName: string; subjectCode: string }) => (
                      <SelectItem key={s.id ?? s._id} value={s.id ?? s._id ?? ''}>{s.subjectName} ({s.subjectCode})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              {errors.subjectId && <p className="text-xs text-destructive">{errors.subjectId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <Controller name="teacherId" control={control} render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select teacher..." /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t: { _id?: string; id?: string; name: string }) => (
                      <SelectItem key={t.id ?? t._id} value={t.id ?? t._id ?? ''}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              {errors.teacherId && <p className="text-xs text-destructive">{errors.teacherId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Day</Label>
              <Controller name="day" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" {...register('startTime')} />
                {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" {...register('endTime')} />
                {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Room (optional)</Label>
              <Input {...register('room')} placeholder="e.g. Room 101, Lab A" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gradient" loading={createMutation.isPending || updateMutation.isPending}>
                {editTarget ? 'Update Entry' : 'Add Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
