import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import {
  QrCode,
  User as UserIcon,
  Mail,
  Shield,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { ApiError } from '@/types'

const schema = z.object({
  username: z.string().optional(),
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const loginPayload = {
        email: data.email.includes('@') ? data.email : `${data.email}@attendx.com`,
        password: data.password,
      }
      const result = await authService.login(loginPayload)
      setAuth(result.user, result.accessToken, result.refreshToken)
      toast({
        title: 'Signed in',
        description: `Logged in as ${result.user.name}`,
        variant: 'success',
      })
      navigate(result.user.role === 'admin' ? '/len-admin' : `/${result.user.role}`)
    } catch (err) {
      const error = err as ApiError
      toast({
        title: 'Authentication failed',
        description: error.response?.data?.message || 'Invalid email or password',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const oauthProviders = [
    { name: 'Google' as const, url: import.meta.env.VITE_OAUTH_GOOGLE_URL as string | undefined },
    { name: 'Apple' as const, url: import.meta.env.VITE_OAUTH_APPLE_URL as string | undefined },
    { name: 'GitHub' as const, url: import.meta.env.VITE_OAUTH_GITHUB_URL as string | undefined },
  ].filter((p) => Boolean(p.url))

  const handleSocialLogin = (provider: 'Google' | 'Apple' | 'GitHub', url?: string) => {
    if (url) {
      window.location.href = url
      return
    }
    toast({
      title: `${provider} Login`,
      description: `${provider} authentication is not configured.`,
      variant: 'default',
    })
  }

  const fillDemoRole = (role: 'admin' | 'teacher' | 'student') => {
    const creds = {
      admin: { username: 'admin', email: 'admin@attendx.com', password: 'Admin@123' },
      teacher: { username: 'teacher1', email: 'teacher1@attendx.com', password: 'Teacher@123' },
      student: { username: 'student1', email: 'student1@attendx.com', password: 'Student@123' },
    }
    setValue('username', creds[role].username)
    setValue('email', creds[role].email)
    setValue('password', creds[role].password)
    setAgreeTerms(true)
    toast({
      title: `${role.charAt(0).toUpperCase() + role.slice(1)} credentials filled`,
      description: creds[role].email,
      variant: 'default',
    })
  }

  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between items-center bg-gradient-to-br from-[#0A0610] via-[#140B1E] to-[#230C1E] text-foreground p-4 sm:p-8 overflow-y-auto relative select-none font-sans antialiased">
      {/* Ambient Sunset Velvet Glows */}
      <div className="pointer-events-none fixed -top-36 -left-36 w-96 h-96 rounded-full bg-rose-500/12 blur-[120px]" />
      <div className="pointer-events-none fixed -bottom-36 -right-36 w-[420px] h-[420px] rounded-full bg-orange-500/12 blur-[130px]" />

      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between z-20 pt-2 pb-4">
        <button
          type="button"
          onClick={() => navigate('/welcome')}
          aria-label="Back to welcome page"
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-md border border-white/15 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-sunset flex items-center justify-center shadow-sm shadow-rose-950/40">
            <QrCode className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-white">AttendX</span>
        </div>

        <div className="w-10" />
      </div>

      {/* Central Frosted Glass Card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md glass-card rounded-3xl p-6 sm:p-8 z-20 my-auto shadow-2xl relative"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Enter your institutional credentials to continue
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          {/* Username */}
          <div className="space-y-1">
            <div className="relative flex items-center">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                id="username"
                type="text"
                placeholder="Username (optional)"
                {...register('username')}
                autoComplete="username"
                className="w-full rounded-2xl border border-border/80 bg-background/50 dark:bg-white/[0.03] py-2.5 sm:py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition-all focus:outline-none focus:border-rose-500/70 focus:ring-2 focus:ring-rose-500/20 backdrop-blur-md"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <div className="relative flex items-center">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                placeholder="Email address"
                {...register('email')}
                autoComplete="email"
                className={`w-full rounded-2xl border bg-background/50 dark:bg-white/[0.03] py-2.5 sm:py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition-all focus:outline-none focus:ring-2 backdrop-blur-md ${
                  errors.email
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-border/80 focus:border-rose-500/70 focus:ring-rose-500/20'
                }`}
              />
            </div>
            {errors.email && (
              <p className="text-[11px] text-red-500 pl-3">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <div className="relative flex items-center">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                {...register('password')}
                autoComplete="current-password"
                className={`w-full rounded-2xl border bg-background/50 dark:bg-white/[0.03] py-2.5 sm:py-3 pl-11 pr-11 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition-all focus:outline-none focus:ring-2 backdrop-blur-md ${
                  errors.password
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-border/80 focus:border-rose-500/70 focus:ring-rose-500/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors p-1"
              >
                {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-red-500 pl-3">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-rose-500 border-border/80 focus:ring-rose-500 cursor-pointer accent-rose-500"
              />
              <span>Remember me</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-rose-500 hover:text-rose-400 transition-colors font-medium"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl gradient-sunset hover:opacity-95 text-white font-semibold py-3 px-6 shadow-lg shadow-rose-950/35 text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Minimal plain-text demo fill links (dev / opt-in only) + social icons */}
        <div className="mt-5 pt-4 border-t border-border/60 space-y-4">
          {(import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true') && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground select-none">
              <span>Demo:</span>
              <button
                type="button"
                onClick={() => fillDemoRole('student')}
                className="hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
              >
                Student
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => fillDemoRole('teacher')}
                className="hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
              >
                Teacher
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => fillDemoRole('admin')}
                className="hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
              >
                Admin
              </button>
            </div>
          )}

          {oauthProviders.length > 0 && (
            <div className="flex items-center justify-center gap-3">
              {oauthProviders.map((provider) => (
                <button
                  key={provider.name}
                  type="button"
                  onClick={() => handleSocialLogin(provider.name, provider.url)}
                  title={`Continue with ${provider.name}`}
                  className="w-10 h-10 rounded-xl bg-background/50 border border-border/80 hover:border-rose-500/30 hover:bg-accent active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer text-xs font-semibold"
                >
                  {provider.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Footer */}
      <div className="w-full max-w-md text-center py-4 z-20">
        <p className="text-xs text-white/50">
          Don't have an account?{' '}
          <Link to="/register" className="text-rose-400 font-semibold hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  )
}
