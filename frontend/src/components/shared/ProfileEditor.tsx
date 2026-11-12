import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Save, KeyRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { USN_REGEX } from '@/lib/usn'
import { ApiError } from '@/types'

const profileSchema = z.object({
  name:       z.string().min(2, 'Min 2 characters'),
  phone:      z.string().optional(),
  department: z.string().min(2, 'Required'),
  year:       z.string().optional(),
  section:    z.string().optional(),
  rollNumber: z.string()
    .optional()
    .refine(v => !v || USN_REGEX.test(v.toUpperCase()), {
      message: 'USN must be in format 4CB25CS001',
    }),
})
type ProfileForm = z.infer<typeof profileSchema>

export function ProfileEditCard() {
  const { user, updateUser } = useAuthStore()
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, control, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name:       user?.name ?? '',
      phone:      user?.phone ?? '',
      department: user?.department ?? '',
      year:       user?.year?.toString() ?? '',
      section:    user?.section ?? '',
      rollNumber: user?.rollNumber ?? '',
    },
  })

  const onSubmit = async (data: ProfileForm) => {
    setSaving(true)
    try {
      const updated = await authService.updateProfile({
        ...data,
        year: data.year ? parseInt(data.year) : undefined,
      })
      updateUser(updated)
      toast({ title: 'Profile updated', variant: 'success' })
    } catch (err) {
      const error = err as ApiError
      toast({ title: 'Update failed', description: error.response?.data?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Save className="w-4 h-4 text-primary" aria-hidden="true" />
          Edit Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pe-name">Full Name</Label>
              <Input id="pe-name" {...register('name')} placeholder="Your full name" />
              {errors.name && <p className="text-xs text-destructive" role="alert">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pe-phone">Phone (optional)</Label>
              <Input id="pe-phone" {...register('phone')} placeholder="+1 234 567 8900" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pe-dept">Department</Label>
              <Input id="pe-dept" {...register('department')} placeholder="Computer Science" />
              {errors.department && <p className="text-xs text-destructive" role="alert">{errors.department.message}</p>}
            </div>

            {user?.role === 'student' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="pe-year">Year</Label>
                  <Controller
                    name="year"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <SelectTrigger id="pe-year"><SelectValue placeholder="Select year" /></SelectTrigger>
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
                  <Label htmlFor="pe-section">Section</Label>
                  <Input id="pe-section" {...register('section')} placeholder="A" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="pe-roll">USN / Roll Number</Label>
                  <Controller
                    name="rollNumber"
                    control={control}
                    render={({ field }) => {
                      const isValid = !field.value || USN_REGEX.test(field.value.toUpperCase())
                      return (
                        <div className="space-y-1">
                          <Input
                            id="pe-roll"
                            placeholder="4CB25CS001"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            maxLength={12}
                            className={`font-mono uppercase tracking-widest ${field.value && !isValid ? 'border-destructive' : ''}`}
                          />
                          <p className={`text-xs ${field.value ? (isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive') : 'text-muted-foreground'}`}>
                            {field.value ? (isValid ? `Valid: ${field.value}` : 'e.g. 4CB25CS001 · year · branch · roll') : 'Format: 4CB25CS001'}
                          </p>
                        </div>
                      )
                    }}
                  />
                  {errors.rollNumber && <p className="text-xs text-destructive" role="alert">{errors.rollNumber.message}</p>}
                </div>
              </>
            )}
          </div>

          <Button type="submit" variant="gradient" className="gap-2" loading={saving}>
            <Save className="w-4 h-4" aria-hidden="true" />
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Change password form ─────────────────────────────────────────────────────
const pwSchema = z.object({
  current:    z.string().min(1, 'Required'),
  newPass:    z.string().min(8, 'At least 8 characters'),
  confirm:    z.string(),
}).refine(d => d.newPass === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type PwForm = z.infer<typeof pwSchema>

export function ChangePasswordCard() {
  const [saving, setSaving] = useState(false)
  const [show, setShow]     = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
  })

  const onSubmit = async (data: PwForm) => {
    setSaving(true)
    try {
      await authService.changePassword(data.current, data.newPass)
      toast({ title: 'Password changed', description: 'Your new password is active.', variant: 'success' })
      reset()
    } catch (err) {
      const error = err as ApiError
      toast({ title: 'Failed', description: error.response?.data?.message || 'Incorrect current password.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const ToggleBtn = () => (
    <button type="button" aria-label={show ? 'Hide' : 'Show'}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      onClick={() => setShow(s => !s)}>
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="w-4 h-4 text-primary" aria-hidden="true" />
          Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-curr">Current Password</Label>
            <div className="relative">
              <Input id="cp-curr" type={show ? 'text' : 'password'} className="pr-10" {...register('current')} />
              <ToggleBtn />
            </div>
            {errors.current && <p className="text-xs text-destructive" role="alert">{errors.current.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">New Password</Label>
            <div className="relative">
              <Input id="cp-new" type={show ? 'text' : 'password'} placeholder="Min 8 characters" className="pr-10" {...register('newPass')} />
              <ToggleBtn />
            </div>
            {errors.newPass && <p className="text-xs text-destructive" role="alert">{errors.newPass.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirm New Password</Label>
            <Input id="cp-confirm" type="password" {...register('confirm')} />
            {errors.confirm && <p className="text-xs text-destructive" role="alert">{errors.confirm.message}</p>}
          </div>
          <Button type="submit" variant="outline" className="gap-2" loading={saving}>
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            Update Password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
