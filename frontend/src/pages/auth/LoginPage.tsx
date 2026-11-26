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

  const handleSocialLogin = (provider: 'Google' | 'Apple' | 'GitHub') => {
    toast({
      title: `${provider} Login`,
      description: `${provider} authentication is not enabled yet. Please use email and password.`,
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

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleSocialLogin('Google')}
              title="Continue with Google"
              className="w-10 h-10 rounded-xl bg-background/50 border border-border/80 hover:border-rose-500/30 hover:bg-accent active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer group"
            >
              <svg className="w-4 h-4 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('Apple')}
              title="Continue with Apple"
              className="w-10 h-10 rounded-xl bg-background/50 border border-border/80 hover:border-rose-500/30 hover:bg-accent active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer group"
            >
              <svg className="w-4 h-4 fill-current transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 7.05c.66-.82 1.11-1.95 1-3.05-.98.04-2.15.65-2.83 1.45-.6.69-1.12 1.83-1 2.93 1.09.08 2.19-.55 2.83-1.33z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('GitHub')}
              title="Continue with GitHub"
              className="w-10 h-10 rounded-xl bg-background/50 border border-border/80 hover:border-rose-500/30 hover:bg-accent active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer group"
            >
              <svg className="w-4 h-4 fill-current transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </button>
          </div>
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
