import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { QrCode, ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authService } from '@/services/auth.service'
import { toast } from '@/hooks/useToast'
import { ApiError } from '@/types'

const schema = z.object({
  email:       z.string().email('Enter a valid email'),
  resetCode:   z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Numbers only'),
  newPassword: z.string().min(8, 'At least 8 characters'),
  confirm:     z.string(),
}).refine(d => d.newPassword === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type Form = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [loading, setLoading]       = useState(false)
  const [showPass, setShowPass]     = useState(false)
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ email, resetCode, newPassword }: Form) => {
    setLoading(true)
    try {
      await authService.resetPassword(email, resetCode, newPassword)
      toast({ title: 'Password reset!', description: 'You can now log in with your new password.', variant: 'success' })
      navigate('/login')
    } catch (err) {
      const error = err as ApiError;
      toast({ title: 'Reset failed', description: error.response?.data?.message || 'Invalid or expired code.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold gradient-text">AttendX</span>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-xl space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Reset password</h2>
            <p className="text-muted-foreground mt-1 text-sm">Enter the code you received and your new password.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rp-email">Email address</Label>
              <Input id="rp-email" type="email" placeholder="you@university.edu" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rp-code">6-digit reset code</Label>
              <Input
                id="rp-code"
                placeholder="123456"
                maxLength={6}
                className="text-center text-lg font-mono tracking-widest h-12"
                {...register('resetCode')}
              />
              {errors.resetCode && <p className="text-xs text-destructive" role="alert">{errors.resetCode.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rp-pass">New password</Label>
              <div className="relative">
                <Input
                  id="rp-pass"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  className="pr-10"
                  {...register('newPassword')}
                />
                <button type="button" aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass(p => !p)}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && <p className="text-xs text-destructive" role="alert">{errors.newPassword.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rp-confirm">Confirm new password</Label>
              <Input id="rp-confirm" type="password" placeholder="Repeat password" {...register('confirm')} />
              {errors.confirm && <p className="text-xs text-destructive" role="alert">{errors.confirm.message}</p>}
            </div>

            <Button type="submit" variant="gradient" className="w-full gap-2" loading={loading}>
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              Set New Password
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link to="/login" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
