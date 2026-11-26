import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QrCode, ArrowRight } from 'lucide-react'

export default function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col justify-between items-center bg-gradient-to-br from-[#0A0610] via-[#140B1E] to-[#230C1E] text-white p-6 sm:p-10 overflow-hidden font-sans antialiased select-none">
      {/* Subtle ambient sunset depth */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-rose-500/15 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-orange-500/12 blur-[140px]" />

      {/* Minimal diagonal glass shapes */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-60"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 400 800"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="rosePill1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FB7185" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="rosePill2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        <g transform="rotate(-35 200 400)">
          <rect x="-110" y="30" width="180" height="540" rx="90" fill="url(#rosePill1)" />
          <rect x="100" y="-90" width="210" height="660" rx="105" fill="url(#rosePill2)" />
          <rect x="250" y="220" width="170" height="520" rx="85" fill="url(#rosePill1)" />
        </g>
      </svg>

      {/* Top Spacer */}
      <div className="pt-2 z-20" />

      {/* Center Brand Identity */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="my-auto z-20 flex flex-col items-center text-center px-4 max-w-md"
      >
        <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-3xl bg-white/[0.07] backdrop-blur-2xl border border-white/15 shadow-2xl shadow-black/50 flex items-center justify-center mb-6">
          <QrCode className="w-11 h-11 sm:w-12 sm:h-12 text-rose-400 stroke-[2]" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3">
          AttendX
        </h1>

        <p className="text-white/70 text-sm max-w-[320px] mx-auto font-normal leading-relaxed">
          Campus attendance and session management for students, faculty, and administrators.
        </p>
      </motion.div>

      {/* Bottom Action Area */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="w-full max-w-xs z-20 flex flex-col items-center pb-6 sm:pb-8"
      >
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-full gradient-sunset hover:opacity-95 text-white font-semibold py-3.5 px-8 rounded-full shadow-xl shadow-rose-950/40 transition-all text-base active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 group"
        >
          <span>Get Started</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/register')}
          className="text-white/70 hover:text-white text-xs font-medium mt-4 cursor-pointer transition-colors"
        >
          New here? <span className="underline underline-offset-2 text-rose-300">Create an account</span>
        </button>

        <div className="flex items-center justify-center gap-3 text-[11px] text-white/45 mt-3 select-none">
          <Link to="/privacy" className="hover:text-white/80 transition-colors">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-white/80 transition-colors">
            Terms of Service
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
