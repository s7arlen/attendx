import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  QrCode, Eye, EyeOff, Loader2,
  TrendingUp, Users, CheckCircle2, Clock,
  BarChart3, Wifi, ShieldCheck, Zap,
  GraduationCap, BookOpen, Shield,
} from 'lucide-react'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { ApiError } from '@/types'

// ── Schema (unchanged) ──────────────────────────────────────
const schema = z.object({
  email:    z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

// ── Sparkline ───────────────────────────────────────────────
function Spark({ values, color = '#a78bfa' }: { values: number[]; color?: string }) {
  const W = 90, H = 32
  const max = Math.max(...values), min = Math.min(...values), range = max - min || 1
  const xs = values.map((_, i) => (i / (values.length - 1)) * W)
  const ys = values.map(v => H - ((v - min) / range) * H * 0.75 - H * 0.1)
  const d  = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const id = `g${color.replace('#', '')}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Floating glass card ─────────────────────────────────────
function GCard({ children, style = {}, delay = 0, rotate = 0 }: {
  children: React.ReactNode; style?: React.CSSProperties; delay?: number; rotate?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.93 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      style={{
        rotate, position: 'absolute',
        background: 'rgba(255,255,255,0.058)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
        borderRadius: 16, ...style,
      }}
    >
      {children}
    </motion.div>
  )
}

function AnimBar({ height, color, delay }: { height: number; color: string; delay: number }) {
  return (
    <motion.div className="flex-1 rounded-sm"
      initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
      style={{ height: `${height}%`, background: color, transformOrigin: 'bottom', minHeight: 2 }}
      transition={{ delay, duration: 0.45, ease: 'easeOut' }}
    />
  )
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [focused, setFocused]           = useState<'email' | 'password' | null>(null)
  const navigate    = useNavigate()
  const { setAuth } = useAuthStore()

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  // ── Auth logic (unchanged) ──────────────────────────────
  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const result = await authService.login(data)
      setAuth(result.user, result.accessToken, result.refreshToken)
      toast({ title: 'Welcome back!', description: `Logged in as ${result.user.name}`, variant: 'success' })
      navigate(result.user.role === 'admin' ? '/len-admin' : `/${result.user.role}`)
    } catch (err) {
      const error = err as ApiError
      toast({ title: 'Login failed', description: error.response?.data?.message || 'Invalid email or password', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // ── Demo fill (unchanged) ──────────────────────────────
  const fillDemo = (role: 'student' | 'teacher' | 'admin') => {
    const creds = {
      student: { email: 'student1@attendx.com', password: 'Student@123' },
      teacher: { email: 'teacher1@attendx.com', password: 'Teacher@123' },
      admin:   { email: 'admin@attendx.com',    password: 'Admin@123'   },
    }
    setValue('email', creds[role].email)
    setValue('password', creds[role].password)
    toast({ title: `${role.charAt(0).toUpperCase() + role.slice(1)} credentials filled`, variant: 'default' })
  }

  const iStyle = (f: 'email' | 'password', err: boolean): React.CSSProperties => ({
    width: '100%', height: 46, borderRadius: 12, outline: 'none',
    padding: '0 44px 0 14px',
    background: focused === f ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.05)',
    border: err ? '1px solid rgba(239,68,68,0.6)' : focused === f ? '1px solid rgba(139,92,246,0.65)' : '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.9)', fontSize: 14,
    boxShadow: focused === f && !err ? '0 0 0 3px rgba(139,92,246,0.14)' : 'none',
    transition: 'all 0.2s ease',
  })

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: '#06040f' }}>

      {/* ═══════════════════════════════════════════════
          LEFT PANEL — dark + floating glass cards
          (hidden on mobile)
      ═══════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col w-[54%] relative overflow-hidden flex-shrink-0"
        style={{
          background: 'linear-gradient(145deg,#0a0720 0%,#100d2e 45%,#160b40 75%,#0d0924 100%)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Glow blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div className="absolute rounded-full"
            style={{ width:520,height:520,left:'-12%',top:'-18%',background:'radial-gradient(circle,rgba(109,40,217,0.2) 0%,transparent 68%)',filter:'blur(55px)' }}
            animate={{ scale:[1,1.1,1] }} transition={{ duration:11,repeat:Infinity,ease:'easeInOut' }} />
          <motion.div className="absolute rounded-full"
            style={{ width:420,height:420,right:'-8%',bottom:'-12%',background:'radial-gradient(circle,rgba(79,70,229,0.16) 0%,transparent 68%)',filter:'blur(55px)' }}
            animate={{ scale:[1,1.14,1] }} transition={{ duration:15,repeat:Infinity,ease:'easeInOut',delay:2 }} />
        </div>

        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.055]"
          style={{ backgroundImage:'radial-gradient(rgba(167,139,250,0.65) 1px,transparent 1px)',backgroundSize:'28px 28px' }} />

        {/* Logo */}
        <motion.div initial={{ opacity:0,y:-14 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.55 }}
          className="relative z-10 p-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background:'linear-gradient(135deg,rgba(109,40,217,0.9),rgba(139,92,246,0.9))',border:'1px solid rgba(255,255,255,0.18)',boxShadow:'0 4px 16px rgba(109,40,217,0.42)' }}>
            <QrCode style={{ width:18,height:18,color:'white' }} />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">AttendX</span>
        </motion.div>

        {/* Headline */}
        <motion.div initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.65,delay:0.14 }}
          className="relative z-10 px-10 mt-1">
          <h1 className="text-[2.4rem] font-extrabold leading-[1.18] tracking-tight text-white">
            Smart Attendance,<br />
            <span style={{ color:'rgba(167,139,250,0.85)' }}>Zero Proxies.</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed max-w-[300px]" style={{ color:'rgba(255,255,255,0.38)' }}>
            Dynamic QR codes and session passwords — the most secure way to verify student attendance in real time.
          </p>
        </motion.div>

        {/* Floating cards */}
        <div className="relative flex-1">
          {/* Card A — Attendance rate */}
          <GCard delay={0.3} rotate={-2} style={{ top:'4%',right:'6%',width:214 }}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.38)' }}>Today's Attendance</p>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background:'rgba(139,92,246,0.18)' }}>
                  <BarChart3 style={{ width:14,height:14,color:'#a78bfa' }} />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-[2.1rem] font-black text-white leading-none">96.5%</span>
                <span className="flex items-center gap-0.5 text-xs font-semibold mb-1" style={{ color:'#34d399' }}>
                  <TrendingUp style={{ width:12,height:12 }} />+4.2%
                </span>
              </div>
              <p className="text-[9px] mt-0.5 mb-3" style={{ color:'rgba(255,255,255,0.28)' }}>from yesterday</p>
              <div className="flex items-end gap-0.5" style={{ height:40 }}>
                {[42,60,52,74,68,82,97].map((h,i) => (
                  <AnimBar key={i} height={h} delay={0.7+i*0.06}
                    color={i===6 ? 'linear-gradient(180deg,#7c3aed,#a78bfa)' : 'rgba(167,139,250,0.22)'} />
                ))}
              </div>
            </div>
          </GCard>

          {/* Card B — Live session */}
          <GCard delay={0.42} rotate={2.5} style={{ top:'33%',left:'4%',width:188 }}>
            <div className="p-3.5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <motion.span className="absolute inline-flex h-full w-full rounded-full" style={{ background:'#34d399' }}
                    animate={{ scale:[1,2.2,1],opacity:[0.75,0,0.75] }} transition={{ duration:1.8,repeat:Infinity }} />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background:'#10b981' }} />
                </span>
                <span className="text-xs font-semibold text-white">Live Session Active</span>
              </div>
              <p className="text-[9px] ml-[18px] mb-3" style={{ color:'rgba(255,255,255,0.32)' }}>CSE — Section A</p>
              <div className="flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background:'rgba(139,92,246,0.14)',border:'1px solid rgba(139,92,246,0.22)' }}>
                <Users style={{ width:12,height:12,color:'#a78bfa',flexShrink:0 }} />
                <span className="text-[9px] font-medium" style={{ color:'#c4b5fd' }}>24 / 60 marked present</span>
              </div>
            </div>
          </GCard>

          {/* Card C — Trend */}
          <GCard delay={0.52} rotate={1.5} style={{ top:'31%',right:'4%',width:198 }}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.38)' }}>Weekly Trend</p>
                <span className="text-[9px] font-bold" style={{ color:'#34d399' }}>+12.4%</span>
              </div>
              <p className="text-lg font-bold text-white mb-2">82 sessions</p>
              <Spark values={[52,45,68,60,82,74,96]} color="#a78bfa" />
              <div className="flex justify-between mt-1">
                {['M','T','W','T','F','S','S'].map((d,i) => (
                  <span key={i} className="text-[8px]" style={{ color:'rgba(255,255,255,0.2)' }}>{d}</span>
                ))}
              </div>
            </div>
          </GCard>

          {/* Card D — Verified */}
          <GCard delay={0.6} rotate={-1.5} style={{ bottom:'24%',right:'7%',width:172 }}>
            <div className="p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'rgba(52,211,153,0.14)' }}>
                <CheckCircle2 style={{ width:16,height:16,color:'#34d399' }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">1,284 Verified</p>
                <p className="text-[9px]" style={{ color:'rgba(255,255,255,0.3)' }}>attendance records</p>
              </div>
            </div>
          </GCard>

          {/* Card E — Next class */}
          <GCard delay={0.68} rotate={1} style={{ bottom:'9%',left:'7%',width:168 }}>
            <div className="p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'rgba(251,191,36,0.13)' }}>
                <Clock style={{ width:16,height:16,color:'#fbbf24' }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Next: 10:30 AM</p>
                <p className="text-[9px]" style={{ color:'rgba(255,255,255,0.3)' }}>Data Structures · B2</p>
              </div>
            </div>
          </GCard>

          {/* Card F — Wifi */}
          <GCard delay={0.74} rotate={-2} style={{ bottom:'38%',left:'11%',width:154 }}>
            <div className="p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'rgba(109,40,217,0.18)' }}>
                <Wifi style={{ width:16,height:16,color:'#a78bfa' }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Real-time Sync</p>
                <p className="text-[9px]" style={{ color:'rgba(255,255,255,0.3)' }}>Socket.IO active</p>
              </div>
            </div>
          </GCard>
        </div>

        {/* Bottom stats */}
        <motion.div initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.9,duration:0.6 }}
          className="relative z-10 px-10 pb-10">
          <div className="grid grid-cols-3 gap-3">
            {[{ value:'99.9%', label:'Accuracy' },{ value:'< 2s', label:'Verification' },{ value:'0', label:'Proxy Attendance' }].map(s => (
              <div key={s.label} className="rounded-xl p-3"
                style={{ background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-[9px] mt-0.5" style={{ color:'rgba(255,255,255,0.33)' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs mt-4" style={{ color:'rgba(255,255,255,0.16)' }}>© 2025 AttendX. Built for modern education.</p>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT PANEL — login form
      ═══════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-14 relative min-h-screen"
        style={{ background:'#0d0b1f' }}>

        {/* Subtle glow */}
        <div className="absolute top-0 left-0 w-72 h-72 pointer-events-none"
          style={{ background:'radial-gradient(circle at 0% 0%,rgba(109,40,217,0.08) 0%,transparent 70%)' }} />

        <motion.div
          initial={{ opacity:0,x:28 }}
          animate={{ opacity:1,x:0 }}
          transition={{ duration:0.65,ease:[0.22,1,0.36,1] }}
          className="w-full max-w-[390px] relative z-10"
        >
          {/* Logo (always shown on mobile, hidden on desktop since left panel has it) */}
          <div className="lg:hidden flex items-center gap-3 mb-9">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background:'linear-gradient(135deg,rgba(109,40,217,0.9),rgba(139,92,246,0.9))',border:'1px solid rgba(255,255,255,0.15)' }}>
              <QrCode style={{ width:18,height:18,color:'white' }} />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">AttendX</span>
          </div>

          {/* Heading */}
          <motion.div initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }} className="mb-8">
            <h2 className="text-[1.9rem] font-extrabold tracking-tight text-white">Welcome back</h2>
            <p className="text-sm mt-1.5" style={{ color:'rgba(255,255,255,0.35)' }}>Sign in to your AttendX account</p>
          </motion.div>

          {/* Form */}
          <motion.form onSubmit={handleSubmit(onSubmit)} className="space-y-4"
            initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.22 }}>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-[11px] font-semibold uppercase tracking-[0.1em]"
                style={{ color:'rgba(255,255,255,0.4)' }}>Email address</label>
              <input
                id="login-email" type="email" autoComplete="email"
                placeholder="you@university.edu"
                {...register('email')}
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                style={{ ...iStyle('email', !!errors.email), paddingLeft: 14, paddingRight: 14 }}
              />
              <AnimatePresence>
                {errors.email && (
                  <motion.p initial={{ opacity:0,y:-4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                    className="text-xs text-red-400 pl-1">{errors.email.message}</motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-[11px] font-semibold uppercase tracking-[0.1em]"
                style={{ color:'rgba(255,255,255,0.4)' }}>Password</label>
              <div className="relative">
                <input
                  id="login-password" type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password" placeholder="Enter your password"
                  {...register('password')}
                  onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                  style={iStyle('password', !!errors.password)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color:'rgba(255,255,255,0.3)' }}>
                  {showPassword ? <EyeOff style={{ width:16,height:16 }} /> : <Eye style={{ width:16,height:16 }} />}
                </button>
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p initial={{ opacity:0,y:-4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                    className="text-xs text-red-400 pl-1">{errors.password.message}</motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Forgot password row */}
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs font-medium transition-colors" style={{ color:'#a78bfa' }}
                onMouseEnter={e => (e.currentTarget.style.color='#c4b5fd')}
                onMouseLeave={e => (e.currentTarget.style.color='#a78bfa')}>
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <motion.button type="submit" disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.012 }} whileTap={{ scale: loading ? 1 : 0.985 }}
              className="w-full flex items-center justify-center gap-2.5 relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm"
              style={{ height:48,borderRadius:12,background:'linear-gradient(135deg,#5b21b6 0%,#6d28d9 50%,#7c3aed 100%)',border:'1px solid rgba(167,139,250,0.22)',boxShadow:'0 8px 28px rgba(109,40,217,0.42),inset 0 1px 0 rgba(255,255,255,0.12)' }}>
              <motion.span className="absolute inset-0 pointer-events-none"
                style={{ background:'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.13) 50%,transparent 65%)' }}
                animate={{ x:['-100%','200%'] }} transition={{ duration:2,repeat:Infinity,repeatDelay:3,ease:'linear' }} />
              {loading ? (
                <><Loader2 style={{ width:16,height:16 }} className="animate-spin" />Signing in…</>
              ) : 'Sign in to AttendX'}
            </motion.button>
          </motion.form>

          {/* Demo fill */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.42 }}
            className="mt-6 pt-5 flex items-center justify-between"
            style={{ borderTop:'1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-xs" style={{ color:'rgba(255,255,255,0.28)' }}>Demo fill:</span>
            <div className="flex items-center gap-2">
              {([
                { role:'student' as const, icon:GraduationCap, color:'rgba(99,102,241,0.2)',  border:'rgba(99,102,241,0.4)',  text:'#818cf8', label:'Student' },
                { role:'teacher' as const, icon:BookOpen,      color:'rgba(245,158,11,0.15)', border:'rgba(245,158,11,0.4)',  text:'#fbbf24', label:'Teacher' },
                { role:'admin'   as const, icon:Shield,        color:'rgba(239,68,68,0.15)',  border:'rgba(239,68,68,0.4)',   text:'#f87171', label:'Admin'   },
              ]).map(({ role, icon:Icon, color, border, text, label }) => (
                <motion.button key={role} type="button" onClick={() => fillDemo(role)}
                  whileHover={{ scale:1.08 }} whileTap={{ scale:0.92 }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background:color, border:`1px solid ${border}`, color:text }}>
                  <Icon style={{ width:12,height:12 }} />
                  {label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Sign up link */}
          <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
            className="text-center text-sm mt-5" style={{ color:'rgba(255,255,255,0.3)' }}>
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold transition-colors" style={{ color:'#a78bfa' }}
              onMouseEnter={e => (e.currentTarget.style.color='#c4b5fd')}
              onMouseLeave={e => (e.currentTarget.style.color='#a78bfa')}>
              Sign up
            </Link>
          </motion.p>

          {/* Trust icons */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.6 }}
            className="mt-8 pt-6 flex items-center justify-between"
            style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            {[
              { icon:ShieldCheck, label:'End-to-end secure' },
              { icon:Zap,         label:'Real-time sync'    },
              { icon:QrCode,      label:'QR + Biometric'    },
            ].map(({ icon:Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background:'rgba(139,92,246,0.11)',border:'1px solid rgba(139,92,246,0.18)' }}>
                  <Icon style={{ width:14,height:14,color:'#a78bfa' }} aria-hidden="true" />
                </div>
                <span className="text-[9px]" style={{ color:'rgba(255,255,255,0.22)' }}>{label}</span>
              </div>
            ))}
          </motion.div>

        </motion.div>
      </div>
    </div>
  )
}
