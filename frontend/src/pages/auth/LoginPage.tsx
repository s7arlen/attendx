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
        title: 'Welcome back!',
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
      description: `${provider} authentication is coming soon. Please use email/password to sign in.`,
      variant: 'default',
    })
  }

  const fillDemoRole = (role: 'admin' | 'teacher' | 'student') => {
    const creds = {
      admin: { username: 'admin', email: 'admin@attendx.com', password: 'Admin@123' },
      teacher: { username: 'teacher', email: 'teacher@attendx.com', password: 'Teacher@123' },
      student: { username: 'student1', email: 'student1@attendx.com', password: 'Student@123' },
    }
    setValue('username', creds[role].username)
    setValue('email', creds[role].email)
    setValue('password', creds[role].password)
    setAgreeTerms(true)
    toast({
      title: `${role.charAt(0).toUpperCase() + role.slice(1)} Demo Filled`,
      description: `Loaded ${creds[role].email}`,
      variant: 'default',
    })
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between bg-white overflow-hidden relative select-none font-sans antialiased">
      {/* ── Top Header with Royal Blue Gradient & Diagonal Capsules ──────── */}
      <div className="relative h-[29dvh] sm:h-[240px] min-h-[175px] w-full bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb] flex flex-col items-center justify-center shrink-0 overflow-hidden text-white">
        
        {/* Back Arrow Button to the First Page (/welcome) */}
        <button
          type="button"
          onClick={() => navigate('/welcome')}
          aria-label="Back to welcome page"
          className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-md shadow-md"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Background Diagonal Capsule Shapes & Hairlines SVG */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 400 300"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="bluePill1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="bluePill2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="blueLine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          <g transform="rotate(-38 200 150)">
            <rect x="-80" y="-120" width="140" height="460" rx="70" fill="url(#bluePill1)" />
            <rect x="90" y="-140" width="165" height="490" rx="82" fill="url(#bluePill2)" />
            <rect x="230" y="-80" width="120" height="390" rx="60" fill="rgba(255,255,255,0.08)" />
            <line x1="-120" y1="50" x2="380" y2="50" stroke="url(#blueLine)" strokeWidth="1.5" />
            <line x1="20" y1="200" x2="480" y2="200" stroke="url(#blueLine)" strokeWidth="1.2" />
          </g>
        </svg>

        {/* ── Official AttendX Squircle Logo Badge (Exact match to Welcome page) ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="z-10 flex flex-col items-center relative"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[26px] sm:rounded-[28px] bg-white shadow-2xl shadow-blue-950/40 flex items-center justify-center ring-4 ring-white/30">
            <QrCode className="w-10 h-10 sm:w-12 sm:h-12 text-[#1d4ed8] stroke-[2.3]" />
          </div>
        </motion.div>
      </div>

      {/* ── Bottom White Sheet with Curved Top (rounded-t-[38px]) ─────────── */}
      <div className="flex-1 w-full bg-white -mt-6 rounded-t-[38px] shadow-2xl px-6 sm:px-8 pt-5 pb-5 flex flex-col justify-between overflow-hidden z-10 relative max-w-lg mx-auto">
        
        {/* "hello!" Heading in Royal Navy Blue */}
        <div className="text-center pt-0.5">
          <h1 className="text-[32px] sm:text-[36px] font-bold text-[#1e3a8a] tracking-tight">
            hello!
          </h1>
        </div>

        {/* ── Inputs Form ─────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 my-auto w-full">
          {/* 1. Username Pill Input */}
          <div className="space-y-0.5">
            <div className="relative flex items-center">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-slate-400" />
              </div>
              <input
                id="username"
                type="text"
                placeholder="Username"
                {...register('username')}
                autoComplete="username"
                className="w-full rounded-full border border-slate-300/80 bg-white py-2.5 sm:py-3 pl-11 pr-4 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>
          </div>

          {/* 2. Email Pill Input */}
          <div className="space-y-0.5">
            <div className="relative flex items-center">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 flex items-center justify-center">
                <Mail className="w-4 h-4 text-slate-400" />
              </div>
              <input
                id="email"
                type="email"
                placeholder="Email"
                {...register('email')}
                autoComplete="email"
                className={`w-full rounded-full border bg-white py-2.5 sm:py-3 pl-11 pr-4 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all focus:outline-none focus:ring-2 ${
                  errors.email
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-slate-300/80 focus:border-[#2563eb] focus:ring-[#2563eb]/20'
                }`}
              />
            </div>
            {errors.email && (
              <p className="text-[11px] text-red-500 pl-4">{errors.email.message}</p>
            )}
          </div>

          {/* 3. Password Pill Input with Visibility Toggle */}
          <div className="space-y-0.5">
            <div className="relative flex items-center">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 flex items-center justify-center">
                <Shield className="w-4 h-4 text-slate-400" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                {...register('password')}
                autoComplete="current-password"
                className={`w-full rounded-full border bg-white py-2.5 sm:py-3 pl-11 pr-11 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all focus:outline-none focus:ring-2 ${
                  errors.password
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-slate-300/80 focus:border-[#2563eb] focus:ring-[#2563eb]/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1"
              >
                {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-red-500 pl-4">{errors.password.message}</p>
            )}
          </div>

          {/* Centered Checkbox matching exact mockup layout */}
          <div className="flex items-center justify-center pt-0.5 pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-[11px] sm:text-xs text-slate-500 select-none">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-[#2563eb] border-slate-300 focus:ring-[#2563eb] cursor-pointer accent-[#2563eb]"
              />
              <span>
                I agree to the <span className="font-semibold text-slate-700">terms and conditions</span>
              </span>
            </label>
          </div>

          {/* ── Primary Pill Gradient Button: Sign Up in Royal Blue ───────── */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-gradient-to-r from-[#1e40af] via-[#2563eb] to-[#3b82f6] hover:opacity-95 text-white font-semibold py-3 sm:py-3.5 px-6 shadow-lg shadow-blue-600/30 text-sm tracking-wide active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign Up</span>
            )}
          </button>
        </form>

        {/* ── Divider & 3 Social / Quick Demo Buttons ─────────────────────── */}
        <div className="space-y-2.5 pt-1 w-full">
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200/90 w-full" />
            <span className="absolute bg-white px-3 text-xs text-slate-400 font-normal">
              or
            </span>
          </div>

          {/* 3 Social Media Login Buttons (Google, Apple, GitHub) */}
          <div className="flex items-center justify-center gap-3.5 pt-0.5">
            {/* Google */}
            <button
              type="button"
              onClick={() => handleSocialLogin('Google')}
              title="Continue with Google"
              className="w-11 h-11 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer group"
            >
              <svg className="w-5 h-5 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            </button>

            {/* Apple */}
            <button
              type="button"
              onClick={() => handleSocialLogin('Apple')}
              title="Continue with Apple"
              className="w-11 h-11 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer group"
            >
              <svg className="w-5 h-5 fill-slate-900 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 7.05c.66-.82 1.11-1.95 1-3.05-.98.04-2.15.65-2.83 1.45-.6.69-1.12 1.83-1 2.93 1.09.08 2.19-.55 2.83-1.33z" />
              </svg>
            </button>

            {/* GitHub */}
            <button
              type="button"
              onClick={() => handleSocialLogin('GitHub')}
              title="Continue with GitHub"
              className="w-11 h-11 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer group"
            >
              <svg className="w-5 h-5 fill-slate-900 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </button>
          </div>

          {/* Social Media Subtext */}
          <p className="text-[11px] text-slate-400 text-center select-none">
            Log in with your <span className="font-bold text-slate-800">social media</span> account
          </p>

          {/* Quick Demo Credential Pills */}
          <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-slate-400 select-none">
            <span className="text-slate-400">Quick demo:</span>
            <button
              type="button"
              onClick={() => fillDemoRole('admin')}
              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer text-[10px]"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => fillDemoRole('teacher')}
              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer text-[10px]"
            >
              Teacher
            </button>
            <button
              type="button"
              onClick={() => fillDemoRole('student')}
              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer text-[10px]"
            >
              Student
            </button>
          </div>
        </div>

        {/* Optional subtle footer link */}
        <div className="text-center pt-1 pb-0.5">
          <Link
            to="/forgot-password"
            className="text-[11px] text-slate-400 hover:text-[#2563eb] transition-colors"
          >
            Forgot your password?
          </Link>
        </div>

      </div>
    </div>
  )
}
