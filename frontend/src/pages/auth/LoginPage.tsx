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
              <div className="absolute left-4.5 pointer-events-none text-slate-500">
                <UserIcon className="w-4 h-4 fill-slate-500 text-slate-500" />
              </div>
              <input
                id="username"
                type="text"
                placeholder="Username"
                {...register('username')}
                autoComplete="username"
                className="w-full rounded-full border border-slate-300/80 bg-white py-2.5 sm:py-3 pl-12 pr-4 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>
          </div>

          {/* 2. Email Pill Input */}
          <div className="space-y-0.5">
            <div className="relative flex items-center">
              <div className="absolute left-4.5 pointer-events-none text-slate-500">
                <Mail className="w-4 h-4 text-slate-500" />
              </div>
              <input
                id="email"
                type="email"
                placeholder="Email"
                {...register('email')}
                autoComplete="email"
                className={`w-full rounded-full border bg-white py-2.5 sm:py-3 pl-12 pr-4 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all focus:outline-none focus:ring-2 ${
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
              <div className="absolute left-4.5 pointer-events-none text-slate-500">
                <Shield className="w-4 h-4 text-slate-500" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                {...register('password')}
                autoComplete="current-password"
                className={`w-full rounded-full border bg-white py-2.5 sm:py-3 pl-12 pr-11 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-all focus:outline-none focus:ring-2 ${
                  errors.password
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-slate-300/80 focus:border-[#2563eb] focus:ring-[#2563eb]/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-4 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
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

          {/* 3 Glossy Colored Rounded Square Buttons (Admin, Teacher, Student) */}
          <div className="flex items-center justify-center gap-4 pt-0.5">
            {/* Red Square - Admin */}
            <button
              type="button"
              onClick={() => fillDemoRole('admin')}
              title="Demo Admin: admin@attendx.com"
              className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#ff2a38] to-[#db061b] hover:brightness-105 active:scale-90 transition-transform shadow-md shadow-red-500/25 relative overflow-hidden cursor-pointer flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30 pointer-events-none" />
            </button>

            {/* Yellow/Orange Square - Teacher */}
            <button
              type="button"
              onClick={() => fillDemoRole('teacher')}
              title="Demo Teacher: teacher@attendx.com"
              className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#ffb400] to-[#e69b00] hover:brightness-105 active:scale-90 transition-transform shadow-md shadow-amber-500/25 relative overflow-hidden cursor-pointer flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30 pointer-events-none" />
            </button>

            {/* Blue Square - Student */}
            <button
              type="button"
              onClick={() => fillDemoRole('student')}
              title="Demo Student: student1@attendx.com"
              className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#0084ff] to-[#0060db] hover:brightness-105 active:scale-90 transition-transform shadow-md shadow-blue-500/25 relative overflow-hidden cursor-pointer flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30 pointer-events-none" />
            </button>
          </div>

          {/* Social Media Subtext */}
          <p className="text-[11px] text-slate-400 text-center select-none">
            Log in with your <span className="font-bold text-slate-800">social media</span> account
          </p>
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
