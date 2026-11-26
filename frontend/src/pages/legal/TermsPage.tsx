import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText,
  Shield,
  ShieldAlert,
  Fingerprint,
  QrCode,
  UserCheck,
  Scale,
  AlertTriangle,
  ArrowLeft,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'

const sections = [
  { id: 'acceptance', title: '1. Acceptance', icon: FileText },
  { id: 'roles', title: '2. User Roles', icon: UserCheck },
  { id: 'anti-proxy', title: '3. Anti-Proxy Rules', icon: ShieldAlert },
  { id: 'webauthn-rules', title: '4. Biometric & Devices', icon: Fingerprint },
  { id: 'qr-protocol', title: '5. Session Protocol', icon: QrCode },
  { id: 'disciplinary', title: '6. Audits & Penalties', icon: AlertTriangle },
  { id: 'availability', title: '7. System Uptime', icon: Shield },
  { id: 'disputes', title: '8. Dispute Resolution', icon: Scale },
]

export default function TermsPage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useThemeStore()
  const [activeSection, setActiveSection] = useState('acceptance')

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
              to="/privacy"
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted"
            >
              Privacy Policy
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
          aria-label="Terms table of contents"
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
            <Scale className="w-3.5 h-3.5" />
            <span>Academic Code of Conduct & Service Agreement</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">Terms & Conditions</h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Effective Date: November 2026 · Governing Entity: AttendX Academic Institution
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Please read these Terms and Conditions carefully. By accessing, registering an account on, or marking attendance through <strong>AttendX</strong>, you agree to be bound by these provisions, institutional academic bylaws, and zero-proxy integrity standards.
          </p>
        </div>

        {/* SECTION 1 */}
        <section id="acceptance" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">1</span>
            Acceptance of Terms
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            By creating an account, authenticating via JWT or WebAuthn, scanning classroom attendance QR codes, or issuing campus visitor passes, you acknowledge that you have read, understood, and consented to these Terms of Service. If you do not agree, you must immediately cease usage of AttendX.
          </p>
        </section>

        {/* SECTION 2 */}
        <section id="roles" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">2</span>
            User Roles & Eligibility
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="p-4 rounded-xl border border-border bg-card space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-500" /> Students
              </p>
              <p className="text-muted-foreground">
                Must register with an authentic institutional USN (e.g. <code>4CB25CS001</code>). Responsible for device security and physical presence in registered classrooms.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" /> Faculty / Teachers
              </p>
              <p className="text-muted-foreground">
                Authorized to initiate sessions, project dynamic QR codes, review live attendee lists, resolve attendance disputes, and perform manual overrides.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-500" /> Security Personnel
              </p>
              <p className="text-muted-foreground">
                Authorized to operate the campus gate scanner, validate visitor passes, and record physical entry and exit timestamps.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-500" /> Administrators
              </p>
              <p className="text-muted-foreground">
                Maintain comprehensive control over subjects, timetables, user activation status, and institutional audit logs.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3 - ZERO PROXY INTEGRITY */}
        <section id="anti-proxy" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">3</span>
            Zero-Tolerance Anti-Proxy & Academic Integrity Policy
          </h2>
          <div className="p-4 sm:p-5 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm sm:text-base text-foreground">Strictly Prohibited Conduct</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  Marking attendance without being physically present inside the designated lecture hall constitutes academic misconduct under institutional disciplinary statutes.
                </p>
              </div>
            </div>
            <ul className="text-xs sm:text-sm text-muted-foreground space-y-2 pl-2">
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>No Proxy Scanning:</strong> You may not scan a QR code on behalf of any other student or bring a peer’s device into the classroom.</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>No Screenshot or Livestream Distribution:</strong> Photographing, capturing video, or transmitting QR codes or password codes over WhatsApp, Telegram, Discord, or any messaging platform is strictly prohibited.</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>No Automated Bots or Scripts:</strong> Reverse-engineering API endpoints, spoofing User-Agents, or automating verification requests via curl or scripts will result in immediate account suspension.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* SECTION 4 */}
        <section id="webauthn-rules" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">4</span>
            Biometric Hardware & Device Responsibility
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            When WebAuthn authentication is enabled:
          </p>
          <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>You agree to register only devices owned and controlled by you.</li>
            <li>Allowing another individual to enroll their biometric template on your device to facilitate proxy attendance is a violation of these terms.</li>
            <li>If your registered device is lost or compromised, you must promptly notify your department administrator or revoke the credential from your profile.</li>
          </ul>
        </section>

        {/* SECTION 5 */}
        <section id="qr-protocol" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">5</span>
            Classroom QR Session Protocol
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Attendance sessions operate under predefined rules enforced by the server:
          </p>
          <div className="space-y-2 text-xs sm:text-sm text-muted-foreground">
            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="font-semibold text-foreground">Time Sensitivity:</span> Dynamic QR codes rotate every 20 seconds. Scans must be completed before the token expires.
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="font-semibold text-foreground">Session Expiration:</span> Sessions expire automatically after the scheduled duration (e.g. 15 minutes). No attendance can be recorded after expiry.
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="font-semibold text-foreground">One Record Per Session:</span> The database enforces a compound unique constraint. Multiple scans for the same session by the same student will produce an HTTP 409 conflict and will not count twice.
            </div>
          </div>
        </section>

        {/* SECTION 6 */}
        <section id="disciplinary" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">6</span>
            Audit Logging & Disciplinary Consequences
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Every transaction is recorded in an immutable audit trail, including user ID, IP address, timestamp, and verification outcome.
          </p>
          <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-2 text-xs sm:text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Violation Penalties</p>
            <p>
              Suspected proxy attempts, concurrent scans across different accounts from identical device signatures, or rate limit infractions are flagged for institutional review. Penalties may include:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Automatic revocation of all attendance credits for the subject session.</li>
              <li>Deactivation of the student's AttendX account.</li>
              <li>Referral to the Academic Disciplinary Board for formal disciplinary hearing.</li>
            </ul>
          </div>
        </section>

        {/* SECTION 7 */}
        <section id="availability" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">7</span>
            System Availability & Connectivity Failovers
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            AttendX is provided on an "as-is" and "as-available" basis. In the event of campus-wide network outages or device failure during a lecture, faculty members retain full authority to utilize manual roster overrides. Failure of student mobile hardware or battery depletion does not excuse attendance requirements.
          </p>
        </section>

        {/* SECTION 8 */}
        <section id="disputes" className="space-y-4 scroll-mt-28">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold">8</span>
            Dispute Resolution & Amendments
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            If a student believes an attendance record was marked absent erroneously (e.g. due to temporary network failure during an active session), they must file an in-app dispute within <strong>48 hours</strong> of session completion. Decisions by the course instructor and academic dean are final.
          </p>
          <p className="text-xs text-muted-foreground">
            AttendX reserves the right to amend these Terms and Conditions to reflect updates in academic policy, security standards, or applicable legislation. Continued use of the platform following any modifications constitutes acceptance of the revised terms.
          </p>
        </section>

        {/* Footer Navigation */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} AttendX Platform. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground underline underline-offset-2">Privacy Policy</Link>
            <Link to="/login" className="hover:text-foreground underline underline-offset-2">Back to Login</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
