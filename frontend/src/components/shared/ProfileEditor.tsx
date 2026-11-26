import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Save, KeyRound, Trash2, MailCheck, ShieldCheck } from 'lucide-react'
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
      const payload =
        user?.role === 'student'
          ? { name: data.name, phone: data.phone }
          : { ...data, year: data.year ? parseInt(data.year) : undefined }
      const updated = await authService.updateProfile(payload)
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
              <Input
                id="pe-dept"
                {...register('department')}
                placeholder="Computer Science"
                disabled={user?.role === 'student'}
              />
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
                      <Select value={field.value ?? ''} onValueChange={field.onChange} disabled>
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
                  <Input id="pe-section" {...register('section')} placeholder="A" disabled />
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
                            disabled
                            maxLength={12}
                            className={`font-mono uppercase tracking-widest ${field.value && !isValid ? 'border-destructive' : ''}`}
                          />
                          <p className="text-xs text-muted-foreground">
                            Department, Year, Section, and USN are locked and managed by administration.
                          </p>
                        </div>
                      )
                    }}
                  />
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

// ── Delete account card ──────────────────────────────────────────────────────
export function DeleteAccountCard() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          Delete Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Permanently remove your AttendX account and associated personal records. This action cannot be undone.
        </p>
        {!confirmOpen ? (
          <Button
            type="button"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmOpen(true)}
          >
            Delete My Account
          </Button>
        ) : (
          <form
            className="space-y-3 pt-1"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!password.trim()) {
                toast({ title: 'Password required', description: 'Enter your current password to confirm deletion.', variant: 'destructive' })
                return
              }
              setDeleting(true)
              try {
                await authService.deleteAccount(password)
                toast({ title: 'Account deleted', description: 'Your account and personal records have been removed.', variant: 'success' })
                logout()
                navigate('/login')
              } catch (err) {
                const error = err as ApiError
                toast({ title: 'Deletion failed', description: error.response?.data?.message || 'Could not delete account.', variant: 'destructive' })
              } finally {
                setDeleting(false)
              }
            }}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Confirm with your current password"
              autoComplete="current-password"
            />
            <div className="flex items-center gap-2">
              <Button type="submit" variant="destructive" size="sm" loading={deleting}>
                Confirm Permanent Deletion
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deleting}
                onClick={() => {
                  setConfirmOpen(false)
                  setPassword('')
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

// ── Email verification card ──────────────────────────────────────────────────
export function EmailVerificationCard() {
  const { user, updateUser } = useAuthStore()
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [devCode, setDevCode] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)

  if (!user) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MailCheck className="w-4 h-4 text-primary" aria-hidden="true" />
          Email Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {user.isEmailVerified ? (
          <div className="flex items-center gap-2.5 p-3 rounded-xl border bg-emerald-500/5 border-emerald-200 dark:border-emerald-900/50 text-sm text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>Your email ({user.email}) is verified.</span>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Verify your institutional email address ({user.email}) with a 6-digit code.
            </p>
            {!codeSent ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={sending}
                onClick={async () => {
                  setSending(true)
                  try {
                    const res = await authService.sendVerification()
                    setCodeSent(true)
                    if (res.devVerifyCode) setDevCode(res.devVerifyCode)
                    toast({ title: 'Verification code sent', description: 'Check your email inbox.', variant: 'success' })
                  } catch (err) {
                    const error = err as ApiError
                    toast({ title: 'Failed', description: error.response?.data?.message || 'Could not send code.', variant: 'destructive' })
                  } finally {
                    setSending(false)
                  }
                }}
              >
                Send Verification Code
              </Button>
            ) : (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!code.trim()) return
                  setVerifying(true)
                  try {
                    await authService.verifyEmail(code.trim())
                    updateUser({ isEmailVerified: true })
                    toast({ title: 'Email verified!', variant: 'success' })
                  } catch (err) {
                    const error = err as ApiError
                    toast({ title: 'Verification failed', description: error.response?.data?.message || 'Invalid code.', variant: 'destructive' })
                  } finally {
                    setVerifying(false)
                  }
                }}
              >
                {devCode && (
                  <p className="text-xs font-mono text-amber-600 dark:text-amber-400">
                    Dev preview code (SMTP unconfigured): {devCode}
                  </p>
                )}
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="font-mono tracking-widest"
                  />
                  <Button type="submit" size="sm" variant="gradient" loading={verifying}>
                    Verify
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
