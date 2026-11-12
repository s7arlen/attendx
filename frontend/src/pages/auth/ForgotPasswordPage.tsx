import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { QrCode, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authService } from '@/services/auth.service'
import { toast } from '@/hooks/useToast'

const schema = z.object({ email: z.string().email('Enter a valid email') })
type Form = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [devCode, setDevCode]   = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ email }: Form) => {
    setLoading(true)
    try {
      const res = await authService.forgotPassword(email)
      setSent(true)
      if (res.devResetCode) setDevCode(res.devResetCode)
    } catch {
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' })
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
          {!sent ? (
            <>
              <div>
                <h2 className="text-2xl font-bold">Forgot password?</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Enter your email and we'll send you a reset code.
                </p>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" placeholder="you@university.edu" {...register('email')} />
                  {errors.email && <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>}
                </div>
                <Button type="submit" variant="gradient" className="w-full gap-2" loading={loading}>
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  Send Reset Code
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Check your email</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  If that email is registered, a 6-digit reset code has been sent.
                </p>
              </div>
              {devCode && (
                <div className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/50 text-left">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Dev mode — reset code:</p>
                  <p className="text-2xl font-mono font-bold tracking-widest mt-1">{devCode}</p>
                </div>
              )}
              <Link to="/reset-password" className="w-full">
                <Button variant="gradient" className="w-full">Enter Reset Code</Button>
              </Link>
            </div>
          )}
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
