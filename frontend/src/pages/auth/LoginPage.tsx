import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import {
  QrCode,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Shield,
} from 'lucide-react'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { ApiError } from '@/types'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
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
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const result = await authService.login(data)
      setAuth(result.user, result.accessToken, result.refreshToken)
      toast({
        title: 'Welcome back!',
        description: `Logged in as ${result.user.name}`,
        variant: 'success',
      })
      navigate(result.user.role === 'admin' ? '/len-admin' : `/${result.user.role}`)
    } catch (err) {
      const error = err as ApiError
      toast({
        title: 'Login failed',
        description: error.response?.data?.message || 'Invalid email or password',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fillDemoRole = (role: 'student' | 'teacher' | 'admin') => {
    const creds = {
      student: { email: 'student1@attendx.com', password: 'Student@123' },
      teacher: { email: 'teacher@attendx.com', password: 'Teacher@123' },
      admin: { email: 'admin@attendx.com', password: 'Admin@123' },
    }
    setValue('email', creds[role].email)
    setValue('password', creds[role].password)
    toast({
      title: `${role.charAt(0).toUpperCase() + role.slice(1)} Demo Filled`,
      description: `Loaded demo credentials for ${creds[role].email}`,
      variant: 'default',
    })
  }

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] w-full bg-[#fafbfc] dark:bg-slate-900 overflow-hidden font-sans antialiased select-none md:select-auto">
      {/* Seamless film-grain texture across the entire screen */}
      <div
        className="fixed inset-0 pointer-events-none z-30 opacity-[0.055] dark:opacity-[0.04] mix-blend-multiply dark:mix-blend-screen bg-grain"
        aria-hidden="true"
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          MOBILE VIEW (Exact match to user's attached Image 2 mobile app UI)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex md:hidden flex-col h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb]">
        {/* Mobile Top Header (Capsule gradient background + AttendX logo) */}
        <div className="relative h-[27dvh] min-h-[160px] max-h-[200px] w-full flex flex-col items-center justify-center shrink-0 overflow-hidden text-white">
          {/* Floating Pill Capsules & Hairlines SVG */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 400 300"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mCapsule1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="mCapsule2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="mHairline" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            <g transform="rotate(-35 200 150)">
              <rect x="-80" y="-100" width="140" height="400" rx="70" fill="url(#mCapsule1)" />
              <rect x="90" y="-120" width="160" height="450" rx="80" fill="url(#mCapsule2)" />
              <rect x="220" y="-80" width="130" height="380" rx="65" fill="rgba(255,255,255,0.08)" />
              <line x1="-100" y1="50" x2="350" y2="50" stroke="url(#mHairline)" strokeWidth="1.5" />
              <line x1="20" y1="180" x2="450" y2="180" stroke="url(#mHairline)" strokeWidth="1.2" />
            </g>
          </svg>

          {/* Back to Welcome Screen Button */}
          <button
            type="button"
            onClick={() => navigate('/welcome')}
            className="absolute top-3 left-4 p-2 text-white/80 hover:text-white rounded-full bg-white/10 backdrop-blur-sm transition-colors active:scale-95 z-20 cursor-pointer"
            aria-label="Back to welcome page"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* AttendX Logo Badge (Image 2 - AttendX Logo Only) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="z-10 flex flex-col items-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-white shadow-xl shadow-blue-950/40 flex items-center justify-center ring-4 ring-white/25">
              <QrCode className="w-7 h-7 text-[#2563eb] stroke-[2.2]" />
            </div>
          </motion.div>
        </div>

        {/* Mobile Bottom Sheet (White rounded-t-[36px] container matching Image 2) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex-1 w-full bg-[#fafbfc] dark:bg-slate-900 rounded-t-[36px] shadow-2xl px-6 pt-5 pb-4 flex flex-col justify-between overflow-hidden z-10"
        >
          {/* Heading */}
          <div className="text-center pt-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              hello!
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sign in with your AttendX account
            </p>
          </div>

          {/* Form with Pill Inputs */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 my-auto">
            {/* Email Pill Input */}
            <div className="space-y-1">
              <div className="relative flex items-center">
                <div className="absolute left-4 pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="mobile-email"
                  type="email"
                  placeholder="Email"
                  {...register('email')}
                  autoComplete="email"
                  className={`w-full rounded-full border bg-white dark:bg-slate-800 py-2.5 pl-11 pr-4 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 shadow-sm transition-all focus:outline-none focus:ring-2 ${
                    errors.email
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/20'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-red-500 pl-4">{errors.email.message}</p>
              )}
            </div>

            {/* Password Pill Input */}
            <div className="space-y-1">
              <div className="relative flex items-center">
                <div className="absolute left-4 pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="mobile-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  {...register('password')}
                  autoComplete="current-password"
                  className={`w-full rounded-full border bg-white dark:bg-slate-800 py-2.5 pl-11 pr-11 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 shadow-sm transition-all focus:outline-none focus:ring-2 ${
                    errors.password
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-red-500 pl-4">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between px-2 pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                />
                <span>Remember for 30 days</span>
              </label>

              <Link
                to="/forgot-password"
                className="text-[11px] sm:text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Pill Button (Matching Image 2: Pill Sign In) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold py-3 px-6 shadow-md shadow-blue-600/25 text-xs sm:text-sm tracking-wide active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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

          {/* Social / Demo Role Login Badges (Matching Image 2: red/yellow/blue squares) */}
          <div className="space-y-2">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              <span className="absolute bg-[#fafbfc] dark:bg-slate-900 px-3 text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider">
                or demo fill
              </span>
            </div>

            <div className="flex items-center justify-center gap-3 pt-0.5">
              {/* Red - Admin */}
              <button
                type="button"
                onClick={() => fillDemoRole('admin')}
                title="Fill Admin Demo"
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white flex items-center justify-center shadow-md shadow-red-500/25 active:scale-90 transition-transform cursor-pointer"
              >
                <Shield className="w-4 h-4" />
              </button>

              {/* Yellow - Teacher */}
              <button
                type="button"
                onClick={() => fillDemoRole('teacher')}
                title="Fill Teacher Demo"
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/25 active:scale-90 transition-transform cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
              </button>

              {/* Blue - Student */}
              <button
                type="button"
                onClick={() => fillDemoRole('student')}
                title="Fill Student Demo"
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/25 active:scale-90 transition-transform cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
              Tap red, yellow or blue icon to auto-fill demo portal
            </p>
          </div>

          {/* Footer Sign Up Link */}
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 pb-1">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DESKTOP VIEW (Wave divider split-screen with SaaS form layout)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-row h-full w-full">
        {/* ── Left Hero Panel ───────────────────────────────────────────────── */}
        <div className="relative w-[44%] lg:w-[42%] h-full bg-gradient-to-b from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] text-white p-12 lg:p-16 flex flex-col justify-between items-center text-center overflow-hidden shrink-0">
          {/* Ambient Glows */}
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-300/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Label */}
          <div className="w-full pt-4 z-10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/welcome')}
              className="text-white/80 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="text-white/80 text-sm tracking-wide font-medium">
              Welcome to
            </span>
            <div className="w-10" />
          </div>

          {/* Center Brand Identity */}
          <div className="my-auto py-8 z-10 flex flex-col items-center">
            <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-white shadow-2xl shadow-blue-950/20 flex items-center justify-center mb-5">
              <QrCode className="w-12 h-12 lg:w-14 lg:h-14 text-[#2563eb] stroke-[2.2]" />
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-white mb-3">
              AttendX
            </h1>

            <p className="text-white/85 text-sm leading-relaxed max-w-[280px] mx-auto font-normal">
              Dynamic QR codes & biometric verification for secure, real-time campus attendance.
            </p>
          </div>

          {/* Bottom Copyright Tag */}
          <div className="w-full pb-4 z-10">
            <p className="text-xs text-white/60 font-medium">
              © {new Date().getFullYear()} AttendX Platform
            </p>
          </div>

          {/* Desktop Vertical Cloud SVG Divider */}
          <div className="absolute top-0 -right-[1px] bottom-0 w-24 lg:w-32 pointer-events-none z-0 h-full">
            <svg
              className="h-full w-full"
              viewBox="0 0 100 600"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M100,0 L56,0 C32,45 28,95 48,135 C66,170 66,190 54,215 C40,240 28,260 22,275 C10,310 26,345 42,380 C50,410 50,430 42,455 C30,480 18,510 16,530 C12,555 34,580 56,600 L100,600 Z"
                fill="rgba(255,255,255,0.18)"
              />
              <path
                d="M100,0 L70,0 C46,45 42,95 62,135 C80,170 80,190 68,215 C54,240 42,260 36,275 C24,310 40,345 56,380 C65,410 65,430 56,455 C44,480 32,510 30,530 C26,555 48,580 70,600 L100,600 Z"
                fill="rgba(255,255,255,0.38)"
              />
              <path
                d="M100,0 L82,0 C58,45 54,95 74,135 C90,170 90,190 78,215 C64,240 54,260 48,275 C36,310 52,345 68,380 C80,410 80,430 70,455 C58,480 46,510 44,530 C40,555 60,580 82,600 L100,600 Z"
                fill="rgba(255,255,255,0.72)"
              />
              <path
                d="M100,0 L92,0 C70,45 66,95 84,135 C95,165 95,185 86,210 C74,238 66,255 60,275 C48,310 64,345 80,380 C93,410 93,430 82,455 C70,480 60,510 58,530 C54,555 72,580 92,600 L100,600 Z"
                className="fill-[#fafbfc] dark:fill-slate-900"
              />
            </svg>
          </div>
        </div>

        {/* ── Right Form Panel (Desktop SaaS Layout) ─────────────────────────── */}
        <div className="relative w-[56%] lg:w-[58%] h-full bg-[#fafbfc] dark:bg-slate-900 p-14 lg:p-20 flex items-center justify-center flex-1">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-md w-full mx-auto relative z-10"
          >
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                Welcome back
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                Please enter your details to sign in.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="desktop-email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Email
                </label>
                <input
                  id="desktop-email"
                  type="email"
                  placeholder="Enter your email"
                  {...register('email')}
                  autoComplete="email"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 bg-white dark:bg-slate-800 transition-colors focus:outline-none focus:ring-2 ${
                    errors.email
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/20'
                  }`}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="desktop-password"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="desktop-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password')}
                    autoComplete="current-password"
                    className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 bg-white dark:bg-slate-800 transition-colors focus:outline-none focus:ring-2 ${
                      errors.password
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Remember Me & Forgot Password Row */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                  <span>Remember for 30 days</span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 shadow-sm hover:shadow transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign in</span>
                )}
              </button>
            </form>

            {/* Quick Demo Fill Buttons on Desktop */}
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Demo fill:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoRole('student')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 font-medium transition-colors cursor-pointer"
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoRole('teacher')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 font-medium transition-colors cursor-pointer"
                >
                  Teacher
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoRole('admin')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 font-medium transition-colors cursor-pointer"
                >
                  Admin
                </button>
              </div>
            </div>

            {/* Footer Sign Up Link */}
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Sign up
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
