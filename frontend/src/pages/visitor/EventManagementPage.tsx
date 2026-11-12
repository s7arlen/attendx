import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit, Trash2, Calendar, MapPin, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import ErrorState from '@/components/shared/ErrorState'
import { visitorService } from '@/services/visitor.service'
import { VisitorEvent, ApiError } from '@/types'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useAuthStore } from '@/store/authStore'

const eventSchema = z.object({
  name:        z.string().min(2),
  description: z.string().optional(),
  eventDate:   z.string().min(1),
  startTime:   z.string().min(1),
  endTime:     z.string().min(1),
  venue:       z.string().min(2),
  maxVisitors: z.string().optional(),
})
type EventForm = z.infer<typeof eventSchema>

export default function EventManagementPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<VisitorEvent | null>(null)

  const { data: events = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['visitor-events'],
    queryFn: visitorService.getEvents,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
  })

  const createMutation = useMutation({
    mutationFn: (d: EventForm) => visitorService.createEvent({
      ...d, maxVisitors: d.maxVisitors ? parseInt(d.maxVisitors) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitor-events'] })
      toast({ title: 'Event created', variant: 'success' })
      setDialogOpen(false); reset()
    },
    onError: (err) => {
      const error = err as ApiError
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EventForm }) =>
      visitorService.updateEvent(id, { ...data, maxVisitors: data.maxVisitors ? parseInt(data.maxVisitors) : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitor-events'] })
      toast({ title: 'Event updated', variant: 'success' })
      setDialogOpen(false); reset()
    },
    onError: (err) => {
      const error = err as ApiError
      toast({ title: 'Update failed', description: error.response?.data?.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: visitorService.deleteEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitor-events'] })
      toast({ title: 'Event removed', variant: 'success' })
    },
  })

  const onSubmit = (d: EventForm) => {
    if (editTarget) updateMutation.mutate({ id: editTarget._id, data: d })
    else createMutation.mutate(d)
  }

  const openEdit = (event: VisitorEvent) => {
    setEditTarget(event)
    reset({
      name: event.name,
      description: event.description,
      eventDate: event.eventDate.split('T')[0],
      startTime: event.startTime,
      endTime: event.endTime,
      venue: event.venue,
      maxVisitors: event.maxVisitors?.toString() ?? '',
    })
    setDialogOpen(true)
  }

  if (isError) return <ErrorState message="Could not load events." onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Event Visitor Management</h2>
          <p className="text-sm text-muted-foreground">{events.length} active events</p>
        </div>
        {user?.role === 'admin' && (
          <Button variant="gradient" onClick={() => { setEditTarget(null); reset({}); setDialogOpen(true) }}>
            <Plus className="w-4 h-4" /> New Event
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No events scheduled</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => {
            const organizer = event.organizer as any
            const isPast = new Date(event.eventDate) < new Date()
            return (
              <Card key={event._id} className={isPast ? 'opacity-70' : ''}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{event.name}</p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                      )}
                    </div>
                    <Badge variant={isPast ? 'default' : 'success'} className="flex-shrink-0">
                      {isPast ? 'Past' : 'Upcoming'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      {formatDate(event.eventDate)} · {event.startTime} – {event.endTime}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      {event.venue}
                    </div>
                    {event.maxVisitors && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 flex-shrink-0" />
                        Max {event.maxVisitors} visitors
                      </div>
                    )}
                    <p>Organizer: {organizer?.name}</p>
                  </div>

                  {user?.role === 'admin' && (
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(event)}>
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteMutation.mutate(event._id)}
                        loading={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Event' : 'Create New Event'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Event Name *</Label>
                <Input {...register('name')} placeholder="Annual Tech Fest..." />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Input {...register('description')} placeholder="Brief description..." />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input {...register('eventDate')} type="date" />
                {errors.eventDate && <p className="text-xs text-destructive">{errors.eventDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Venue *</Label>
                <Input {...register('venue')} placeholder="Main Auditorium" />
              </div>
              <div className="space-y-1.5">
                <Label>Start Time *</Label>
                <Input {...register('startTime')} type="time" />
              </div>
              <div className="space-y-1.5">
                <Label>End Time *</Label>
                <Input {...register('endTime')} type="time" />
              </div>
              <div className="space-y-1.5">
                <Label>Max Visitors</Label>
                <Input {...register('maxVisitors')} type="number" min="1" placeholder="Unlimited" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gradient" loading={createMutation.isPending || updateMutation.isPending}>
                {editTarget ? 'Save Changes' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
