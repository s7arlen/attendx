import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield,
  Fingerprint,
  QrCode,
  Lock,
  Clock,
  UserCheck,
  EyeOff,
  Server,
  FileText,
  ArrowLeft,
  ChevronRight,
  Sun,
  Moon,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'

const sections = [
  { id: 'overview', title: '1. Overview & Scope', icon: FileText },
  { id: 'data-collected', title: '2. Information We Collect', icon: UserCheck },
  { id: 'biometrics', title: '3. WebAuthn & Zero Biometrics', icon: Fingerprint },
  { id: 'dynamic-qr', title: '4. Dynamic QR Verification', icon: QrCode },
  { id: 'visitor-privacy', title: '5. Campus Visitor Privacy', icon: Shield },
  { id: 'data-retention', title: '6. Retention & 90-Day TTL', icon: Clock },
  { id: 'security-measures', title: '7. Cryptographic Security', icon: Lock },
  { id: 'user-rights', title: '8. User Rights & Governance', icon: Server },
]

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useThemeStore()
  const [activeSection, setActiveSection] = useState('overview')

  const scrollTo = (id: string) => {
    setActiveSection(id)
    const element = document.getElementById(id)
    if (element) {
      const yOffset = -90
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  // Update active pill on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140
      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (el) {
          const top = el.offsetTop
          const height = el.offsetHeight
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id)
            break
          }
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      {/* ── Top Sticky App Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Go back to previous page"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Link to="/welcome" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 gradient-bg rounded-xl flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-foreground">AttendX</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/terms"
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted"
            >
              Terms of Service
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>

        {/* ── Mobile Horizontal Pill Navigation ──────────────────────────── */}
        <nav
          aria-label="Table of contents"
          className="w-full border-t border-border/40 bg-muted/30 overflow-x-auto no-scrollbar py-2 px-4 scroll-smooth"
        >
          <div className="max-w-5xl mx-auto flex items-center gap-2 min-w-max">
            {sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollTo(sec.id)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer min-h-[36px] ${
                  activeSection === sec.id
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                    : 'bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60'
                }`}
              >
                <sec.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{sec.title.split('. ')[1]}</span>
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* ── Main Content Area ───────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* Title Hero */}
        <div className="space-y-3 pb-6 border-b border-border/80">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <Shield className="w-3.5 h-3.5" />
            <span>Institutional Privacy Standard</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Effective Date: November 2026 · Platform: AttendX Academic & Campus Security System
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            This Privacy Policy describes how <strong>AttendX</strong> collects, processes, and protects your personal, academic, and session verification data in compliance with data protection regulations, including the Digital Personal Data Protection (DPDP) Act and international privacy frameworks.
          </p>
        </div>

        {/* SECTION 1 */}
        <section id="overview" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">1</span>
            Overview & Core Philosophy
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            AttendX is built on a <strong>zero-trust, privacy-by-design</strong> architecture. Unlike traditional attendance solutions that store biometric templates on remote servers or track continuous student location, AttendX only performs <em>point-in-time cryptographic verification</em> inside verified academic lecture halls.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl border border-border bg-card/60 space-y-1.5">
              <EyeOff className="w-5 h-5 text-emerald-500" />
              <p className="font-semibold text-sm">No Location Tracking</p>
              <p className="text-xs text-muted-foreground">We never track your GPS coordinates in the background outside attendance scans.</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card/60 space-y-1.5">
              <Fingerprint className="w-5 h-5 text-blue-500" />
              <p className="font-semibold text-sm">Zero Biometric Storage</p>
              <p className="text-xs text-muted-foreground">Fingerprints and FaceID never leave your phone’s hardware enclave.</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card/60 space-y-1.5">
              <Clock className="w-5 h-5 text-amber-500" />
              <p className="font-semibold text-sm">90-Day Auto Purge</p>
              <p className="text-xs text-muted-foreground">Audit logs expire and are permanently wiped via database TTL indexes.</p>
            </div>
          </div>
        </section>

        {/* SECTION 2 */}
        <section id="data-collected" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">2</span>
            Information We Collect
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            We collect only the minimum required information necessary to authenticate users, prevent fraudulent proxy attendance, and maintain academic records:
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <p className="text-sm font-semibold text-foreground">Academic Profile Information</p>
              <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li><strong>Full Name, Email Address, and Phone Number (Optional)</strong> for account recovery and alerts.</li>
                <li><strong>University Seat Number (USN / Roll Number)</strong> in institutional format (e.g. <code>4CB25CS001</code>).</li>
                <li><strong>Academic Cohort:</strong> Department, Year of Study (1–4), Section, and Enrolled Subjects.</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <p className="text-sm font-semibold text-foreground">Verification & Diagnostic Data</p>
              <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li><strong>Session Metadata:</strong> Timestamp of verification, subject ID, and teacher session identifier.</li>
                <li><strong>Client IP Address:</strong> Collected at the moment of scan strictly to detect proxy bursts and NAT network anomalies.</li>
                <li><strong>User-Agent & Device Type:</strong> Used to render the camera scanner and WebAuthn authenticator compatibility.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION 3 - CRITICAL BIO METRIC GUARANTEE */}
        <section id="biometrics" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">3</span>
            WebAuthn & Zero Biometric Storage Guarantee
          </h2>
          <div className="p-4 sm:p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-start gap-3">
              <Fingerprint className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm sm:text-base text-foreground">Our Cryptographic Hardware Guarantee</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  AttendX strictly enforces the <strong>FIDO2 / WebAuthn W3C standard</strong>. When you register TouchID, FaceID, or Windows Hello:
                </p>
              </div>
            </div>
            <ul className="text-xs sm:text-sm text-muted-foreground space-y-2 pl-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Your physical fingerprint, facial scan, or lockscreen PIN <strong>never leaves your device</strong>. It stays isolated inside your hardware Trusted Platform Module (TPM) or Secure Enclave.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>AttendX servers only store an <strong>asymmetric public key</strong> and a credential ID. It is mathematically impossible for anyone to reconstruct your biometric data from this public key.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Every biometric assertion includes a monotonic hardware signature counter to permanently prevent credential replay attacks.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* SECTION 4 */}
        <section id="dynamic-qr" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">4</span>
            Dynamic QR Code Processing
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Attendance sessions utilize 20-second rotating cryptographic tokens. The QR payload contains only session identifiers, timestamps, and high-entropy 256-bit pseudorandom tokens generated via <code>crypto.randomBytes(32)</code>. No personal identity data is ever embedded in the QR image itself.
          </p>
        </section>

        {/* SECTION 5 */}
        <section id="visitor-privacy" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">5</span>
            Campus Visitor & Security Gate Privacy
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            For campus visitors, contractors, and guests:
          </p>
          <ul className="text-xs sm:text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li><strong>Zero PII in Visitor Passes:</strong> The QR pass issued to visitors contains only a short reference code (e.g. <code>VIS-K82M19</code>) and generation timestamp. Scanning the code in a standard camera app reveals no phone numbers, names, or addresses.</li>
            <li><strong>SHA-256 Token Hashing:</strong> Raw security gate access tokens are hashed via SHA-256 prior to database storage.</li>
            <li><strong>Host Authorization:</strong> Visitor details are visible solely to the designated host, security gate officers, and campus administrators.</li>
          </ul>
        </section>

        {/* SECTION 6 */}
        <section id="data-retention" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">6</span>
            Data Retention & 90-Day TTL Automation
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            To prevent indefinite data hoarding, AttendX maintains automated data lifecycle rules:
          </p>
          <div className="p-4 rounded-xl border border-border bg-card space-y-2">
            <p className="text-sm font-semibold">Automated TTL Policy</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              All system audit logs, device IP mappings, and transient security verification events are bound to a <strong>MongoDB TTL (Time-To-Live) index of 7,776,000 seconds (90 days)</strong>. After 90 days, MongoDB’s background eviction thread permanently purges these logs.
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              AuditLogSchema.index({'{ timestamp: 1 }'}, {'{ expireAfterSeconds: 7776000 }'})
            </p>
          </div>
        </section>

        {/* SECTION 7 */}
        <section id="security-measures" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">7</span>
            Cryptographic Security & Safeguards
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="p-3.5 rounded-xl border border-border bg-card/80 space-y-1">
              <p className="font-semibold text-foreground">Password Hashing</p>
              <p className="text-muted-foreground">Bcrypt with 12 salt rounds (4,096 iterations) against offline brute-forcing.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card/80 space-y-1">
              <p className="font-semibold text-foreground">In-Transit Encryption</p>
              <p className="text-muted-foreground">All API traffic and WebSocket frames are encrypted via TLS 1.3 / HTTPS.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card/80 space-y-1">
              <p className="font-semibold text-foreground">Stateless Token Lifecycle</p>
              <p className="text-muted-foreground">15-minute access tokens minimize exposure if packets are intercepted.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card/80 space-y-1">
              <p className="font-semibold text-foreground">HTTP Security Headers</p>
              <p className="text-muted-foreground">Enforced through Helmet (HSTS, X-Frame-Options, X-Content-Type-Options).</p>
            </div>
          </div>
        </section>

        {/* SECTION 8 */}
        <section id="user-rights" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">8</span>
            User Rights & Institutional Governance
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            As an authenticated user of AttendX, you have specific rights concerning your records:
          </p>
          <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li><strong>Right to Inspect:</strong> View your subject-wise attendance history and percentage analytics at any time.</li>
            <li><strong>Right to Dispute:</strong> Students can file formal attendance dispute tickets directly from the portal for review by faculty or administrators.</li>
            <li><strong>Right to Credential Revocation:</strong> You can unregister any registered WebAuthn biometric device at any time from your profile settings.</li>
            <li><strong>Right to Account &amp; Data Deletion:</strong> Users may delete their account directly via self-service deletion (<code>DELETE /api/auth/account</code>) or request institutional purge through <code>privacy@attendx.edu</code>.</li>
            <li><strong>Right to Rectification:</strong> Request correction of inaccurate profile data through your department administrator.</li>
          </ul>

          <div className="p-4 rounded-xl border border-border bg-card space-y-2">
            <p className="text-sm font-semibold">Sub-processors &amp; External Services</p>
            <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li><strong>AttendX ML Risk Service:</strong> Processes anonymized academic attendance rates, internal scores, and assignment completion metrics strictly for risk scoring and early intervention alerts.</li>
              <li><strong>Cloudinary Media CDN:</strong> Stores user-uploaded profile avatars securely over HTTPS when enabled.</li>
              <li><strong>Transactional SMTP Provider:</strong> Delivers password reset codes, visitor QR passes, and low-attendance warnings.</li>
            </ul>
          </div>

          <div className="pt-4 p-4 rounded-xl border border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Questions or privacy concerns? Contact the AttendX Campus Administration at <span className="font-medium text-foreground">privacy@attendx.edu</span> or submit a ticket through the Help Desk.
            </p>
          </div>
        </section>

        {/* Footer Navigation */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} AttendX Platform. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-foreground underline underline-offset-2">Terms of Service</Link>
            <Link to="/login" className="hover:text-foreground underline underline-offset-2">Back to Login</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
