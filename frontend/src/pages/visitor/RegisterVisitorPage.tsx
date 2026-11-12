import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { visitorService } from '@/services/visitor.service'
import { toast } from '@/hooks/useToast'
import { ApiError } from '@/types'

const schema = z.object({
  fullName:          z.string().min(2, 'Full name required'),
  phone:             z.string().min(6, 'Phone required'),
  email:             z.string().email().optional().or(z.literal('')),
  category:          z.enum(['guest','vendor','parent','official','delivery','interview','contractor','other']),
  nationalId:        z.string().optional(),
  address:           z.string().optional(),
  company:           z.string().optional(),
  notes:             z.string().optional(),
  hostId:            z.string().min(1, 'Select a host'),
  purpose:           z.string().min(3, 'Purpose required'),
  department:        z.string().min(2, 'Department required'),
  visitDate:         z.string().min(1, 'Visit date required'),
  expectedArrival:   z.string().min(1, 'Expected arrival required'),
  expectedDeparture: z.string().min(1, 'Expected departure required'),
  accompanyingCount: z.string().optional(),
  visitType:         z.enum(['pre-registered', 'walk-in']),
})
type FormValues = z.infer<typeof schema>

export default function RegisterVisitorPage() {
  const navigate = useNavigate()

  const { data: hosts = [] } = useQuery({
    queryKey: ['visitor-hosts'],
    queryFn: visitorService.getHosts,
  })

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      visitType: 'pre-registered',
      category: 'guest',
      accompanyingCount: '0',
      visitDate: new Date().toISOString().split('T')[0],
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => visitorService.registerVisitor({
      ...data,
      accompanyingCount: parseInt(data.accompanyingCount || '0'),
      email: data.email || undefined,
    }),
    onSuccess: (visit) => {
      toast({ title: 'Visitor registered', description: 'Host has been notified for approval.', variant: 'success' })
      navigate(`/visitor/visits/${visit._id}`)
    },
    onError: (err) => {
      const error = err as ApiError
      toast({ title: 'Registration failed', description: error.response?.data?.message, variant: 'destructive' })
    },
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Register Visitor</h2>
        <p className="text-sm text-muted-foreground">Pre-register a visitor or add a walk-in</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        {/* Visitor Info */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" />Visitor Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Visit Type</Label>
              <Controller name="visitType" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre-registered">Pre-registered</SelectItem>
                    <SelectItem value="walk-in">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>

            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input {...register('fullName')} placeholder="John Doe" />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input {...register('phone')} placeholder="+1 234 567 8900" />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register('email')} type="email" placeholder="visitor@example.com" />
            </div>

            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Controller name="category" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['guest','vendor','parent','official','delivery','interview','contractor','other'].map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>

            <div className="space-y-1.5">
              <Label>National ID / Passport</Label>
              <Input {...register('nationalId')} placeholder="ID number" />
            </div>

            <div className="space-y-1.5">
              <Label>Company / Organisation</Label>
              <Input {...register('company')} placeholder="Company name" />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input {...register('address')} placeholder="Home address" />
            </div>
          </CardContent>
        </Card>

        {/* Visit Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Visit Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Host (Person to Meet) *</Label>
              <Controller name="hostId" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select host..." /></SelectTrigger>
                  <SelectContent>
                    {hosts.map((h) => (
                      <SelectItem key={h._id} value={h._id}>
                        {h.name} — {h.department} ({h.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              {errors.hostId && <p className="text-xs text-destructive">{errors.hostId.message}</p>}
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Purpose of Visit *</Label>
              <Input {...register('purpose')} placeholder="e.g. Meeting, Delivery, Interview..." />
              {errors.purpose && <p className="text-xs text-destructive">{errors.purpose.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Department *</Label>
              <Input {...register('department')} placeholder="e.g. Computer Science" />
              {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Visit Date *</Label>
              <Input {...register('visitDate')} type="date" />
              {errors.visitDate && <p className="text-xs text-destructive">{errors.visitDate.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Expected Arrival *</Label>
              <Input {...register('expectedArrival')} type="time" />
              {errors.expectedArrival && <p className="text-xs text-destructive">{errors.expectedArrival.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Expected Departure *</Label>
              <Input {...register('expectedDeparture')} type="time" />
              {errors.expectedDeparture && <p className="text-xs text-destructive">{errors.expectedDeparture.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Accompanying Visitors</Label>
              <Input {...register('accompanyingCount')} type="number" min="0" max="20" placeholder="0" />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Input {...register('notes')} placeholder="Any additional notes..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" variant="gradient" loading={mutation.isPending}>
            <UserPlus className="w-4 h-4" />
            Register Visitor
          </Button>
        </div>
      </form>
    </div>
  )
}
