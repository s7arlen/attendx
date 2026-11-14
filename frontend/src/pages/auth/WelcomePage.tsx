import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QrCode, ArrowRight } from 'lucide-react'

export default function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between items-center bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb] text-white p-6 sm:p-10 overflow-hidden font-sans antialiased select-none">
      {/* Film grain noise overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-30 opacity-[0.05] mix-blend-multiply bg-grain"
        aria-hidden="true"
      />

      {/* Floating Diagonal Pill Capsules & Hairlines SVG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 400 800"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="wPill1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="wPill2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="wLine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <g transform="rotate(-35 200 400)">
          <rect x="-110" y="30" width="180" height="540" rx="90" fill="url(#wPill1)" />
          <rect x="100" y="-90" width="210" height="660" rx="105" fill="url(#wPill2)" />
          <rect x="250" y="220" width="170" height="520" rx="85" fill="url(#wPill1)" />
          <rect x="330" y="-140" width="140" height="440" rx="70" fill="rgba(255,255,255,0.08)" />

          <line x1="-160" y1="180" x2="360" y2="180" stroke="url(#wLine)" strokeWidth="1.5" />
          <line x1="30" y1="400" x2="560" y2="400" stroke="url(#wLine)" strokeWidth="1.2" />
          <line x1="-60" y1="-40" x2="420" y2="-40" stroke="url(#wLine)" strokeWidth="1" />
          <line x1="170" y1="620" x2="600" y2="620" stroke="url(#wLine)" strokeWidth="1.5" />
        </g>
      </svg>

      {/* Subtle Glow */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Spacer */}
      <div className="pt-2 z-10 opacity-0 pointer-events-none">
        <span className="text-xs">AttendX</span>
      </div>

      {/* Center Brand Identity with Official AttendX QR Badge Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="my-auto z-10 flex flex-col items-center text-center px-4"
      >
        {/* Official AttendX Squircle QR Logo Badge */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[28px] bg-white shadow-2xl shadow-blue-950/40 flex items-center justify-center mb-5 ring-4 ring-white/25">
          <QrCode className="w-12 h-12 sm:w-14 sm:h-14 text-[#1d4ed8] stroke-[2.2]" />
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          AttendX
        </h1>

        {/* Tagline */}
        <p className="text-white/85 text-xs sm:text-sm max-w-[280px] mx-auto font-normal leading-relaxed">
          Dynamic QR codes & biometric verification for secure campus attendance.
        </p>
      </motion.div>

      {/* Bottom Action Area (Get Started Pill + I already have an account) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="w-full max-w-xs z-10 flex flex-col items-center pb-6 sm:pb-8"
      >
        <button
          type="button"
          onClick={() => navigate('/register')}
          className="w-full bg-white hover:bg-slate-50 text-[#1d4ed8] font-bold py-3.5 px-8 rounded-full shadow-2xl shadow-blue-950/30 transition-all text-base tracking-wide active:scale-95 cursor-pointer flex items-center justify-center gap-2 group"
        >
          <span>Get Started</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-white/80 hover:text-white text-xs font-medium tracking-wide mt-3.5 cursor-pointer transition-colors active:opacity-75"
        >
          I already have an account
        </button>
      </motion.div>
    </div>
  )
}
