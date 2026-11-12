import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import {
  QrCode, KeyRound, CheckCircle2, ArrowLeft,
  BookOpen, Camera, Keyboard, Loader2, Fingerprint, ShieldAlert,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { attendanceService } from '@/services/attendance.service'
import { webauthnService } from '@/services/webauthn.service'
import { useSocket } from '@/hooks/useSocket'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { ApiError } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────
type Mode   = 'choose' | 'camera' | 'manual'
type Verify = 'pick' | 'password' | 'biometric'

interface ValidatedSession {
  id:         string
  subject?:   { _id?: string; subjectName?: string; subjectCode?: string }
  qrToken:    string
}

// ─── QR scanner (stays mounted until decoded) ────────────────────────────────
function QRScannerView({ onDecoded, onFallback }: {
  onDecoded:  (text: string) => void
  onFallback: () => void
}) {
  const startedRef  = useRef(false)
  const resolvedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const scanner = new Html5Qrcode('qr-viewfinder')

    scanner.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 220, height: 220 } },
      (text) => {
        if (resolvedRef.current) return
        resolvedRef.current = true
        scanner.stop().catch(() => {})
        onDecoded(text)
      },
      () => {}
    ).catch(() => {
      toast({ title: 'Camera unavailable', description: 'Grant camera permission or enter the code manually.', variant: 'destructive' })
      onFallback()
    })

    return () => { scanner.stop().catch(() => {}) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[280px] rounded-2xl overflow-hidden border-4 border-primary/30 shadow-lg bg-black">
        <div id="qr-viewfinder" className="w-full" style={{ minHeight: 260 }} />
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <span className="absolute top-4 left-4  w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-lg" />
          <span className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-lg" />
          <span className="absolute bottom-4 left-4  w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-lg" />
          <span className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-lg" />
          <span className="absolute left-8 right-8 top-1/2 h-0.5 bg-primary/80 animate-pulse" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center px-4">
        Point your camera at the QR code on the teacher's screen
      </p>
    </div>
  )
}

// ─── Session confirmed banner ────────────────────────────────────────────────
function SessionBanner({ session }: { session: ValidatedSession }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-200 dark:border-emerald-900/50">
      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center" aria-hidden="true">
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Session verified</p>
        <p className="font-semibold text-sm truncate">{session.subject?.subjectName || 'Session found'}</p>
        <p className="text-xs text-muted-foreground font-mono">{session.subject?.subjectCode}</p>
      </div>
      <Badge variant="success">Active</Badge>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ScanQRPage() {
  const [mode,          setMode]          = useState<Mode>('choose')
  const [verifyMethod,  setVerifyMethod]  = useState<Verify>('pick')
  const [sessionCode,   setSessionCode]   = useState('')
  const [passwordCode,  setPasswordCode]  = useState('')
  const [session,       setSession]       = useState<ValidatedSession | null>(null)
  const [showDone,      setShowDone]      = useState(false)
  const [biometricBusy, setBiometricBusy] = useState(false)

  const { user } = useAuthStore()

  const reset = useCallback(() => {
    setMode('choose'); setSession(null); setVerifyMethod('pick')
    setSessionCode(''); setPasswordCode(''); setShowDone(false)
    validateQRMutation.reset(); findMutation.reset(); passwordMutation.reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for session:ended — notify student if teacher closes session mid-verification
  const socket = useSocket()
  useEffect(() => {
    if (!session) return
    socket.watchSession(session.id)
    const off = socket.onEvent('session:ended', () => {
      toast({
        title: 'Session ended by teacher',
        description: 'This session is no longer active. Your attendance was not recorded.',
        variant: 'destructive',
      })
      reset()
    })
    return off
  // socket and reset are stable refs — intentionally omitted to prevent re-subscribe on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  // hasBiometric reads from user store — no extra query needed
  const hasBiometric = user?.hasWebAuthn ?? false

  // ── QR payload validation ────────────────────────────────────────────────
  const validateQRMutation = useMutation({
    mutationFn: (p: { sessionId: string; secureToken: string }) => attendanceService.validateQR(p),
    onSuccess: (data, variables) => {
      if (data.alreadyMarked) {
        toast({ title: 'Already marked', description: 'Attendance already recorded for this session.', variant: 'destructive' })
        setMode('choose'); return
      }
      setSession({ id: data.session?.id || variables.sessionId, subject: data.session?.subject, qrToken: variables.secureToken })
      setVerifyMethod('pick')
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'QR expired or invalid', description: error.response?.data?.message || 'Ask your teacher to refresh the QR.', variant: 'destructive' })
      setMode('choose')
    },
  })

  const handleQRDecoded = (text: string) => {
    try {
      const payload = JSON.parse(text)
      if (!payload.sessionId || !payload.secureToken) throw new Error('bad')
      validateQRMutation.mutate({ sessionId: payload.sessionId, secureToken: payload.secureToken })
    } catch {
      toast({ title: 'Unrecognised QR', description: 'Not an AttendX QR. Try entering the code manually.', variant: 'destructive' })
      setMode('choose')
    }
  }

  // ── Manual session code lookup ───────────────────────────────────────────
  const findMutation = useMutation({
    mutationFn: () => attendanceService.findSessionByCode(sessionCode.trim().toUpperCase()),
    onSuccess: (data) => {
      if (data.alreadyMarked) {
        toast({ title: 'Already marked', variant: 'destructive' }); return
      }
      setSession({ id: data.session.id, subject: data.session.subject, qrToken: data.session.qrToken })
      setVerifyMethod('pick')
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Session not found', description: error.response?.data?.message || 'Check the code and try again.', variant: 'destructive' })
    },
  })

  // ── Password verify ──────────────────────────────────────────────────────
  const passwordMutation = useMutation({
    mutationFn: () => attendanceService.verifyAttendance({
      sessionId:    session!.id,
      subjectId:    session!.subject?._id || '',
      secureToken:  session!.qrToken,
      passwordCode: passwordCode.trim().toUpperCase(),
    }),
    onSuccess: () => { setShowDone(true); toast({ title: 'Attendance marked!', variant: 'success' }) },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Wrong password', description: error.response?.data?.message || 'Try again.', variant: 'destructive' })
    },
  })

  // ── Biometric verify ─────────────────────────────────────────────────────
  const handleBiometric = async () => {
    if (!session) return
    setBiometricBusy(true)
    try {
      await webauthnService.verifyAttendanceWithBiometric({
        sessionId:   session.id,
        subjectId:   session.subject?._id || '',
        secureToken: session.qrToken,
      })
      setShowDone(true)
      toast({ title: 'Attendance marked!', description: 'Verified via biometrics.', variant: 'success' })
    } catch (err) {
      const error = err as ApiError;
      const msg = error.response?.data?.message || error.message || 'Biometric verification failed.'
      // User cancelled the prompt — don't show an error toast, just stay on the page
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('user')) {
        // silent
      } else {
        toast({ title: 'Biometric failed', description: msg, variant: 'destructive' })
      }
    } finally {
      setBiometricBusy(false)
    }
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (showDone) return (
    <div className="max-w-md mx-auto mt-10">
      <Card className="border-emerald-200 dark:border-emerald-900/50">
        <CardContent className="py-14 flex flex-col items-center gap-5 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Attendance Marked!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Recorded for <span className="font-medium text-foreground">{session?.subject?.subjectName || 'your session'}</span>.
            </p>
          </div>
          <Button variant="outline" onClick={reset}>Mark Another</Button>
        </CardContent>
      </Card>
    </div>
  )

  // ── Verification method picker (shown after session is confirmed) ─────────
  const VerifyPicker = () => (
    <div className="space-y-4">
      <SessionBanner session={session!} />
      <p className="text-sm font-medium text-center">How would you like to verify?</p>
      <div className="grid grid-cols-1 gap-3">

        {/* Option 1 — Password */}
        <button
          onClick={() => setVerifyMethod('password')}
          className="flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
            <KeyRound className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-sm">Enter Session Password</p>
            <p className="text-xs text-muted-foreground mt-0.5">Type the password shown on the teacher's screen</p>
          </div>
        </button>

        {/* Option 2 — Biometric */}
        <button
          onClick={() => hasBiometric ? handleBiometric() : setVerifyMethod('biometric')}
          disabled={biometricBusy}
          className="flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-violet-500 hover:bg-violet-500/5 transition-all duration-200 text-left group disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors flex-shrink-0">
            {biometricBusy
              ? <Loader2 className="w-6 h-6 text-violet-500 animate-spin" aria-hidden="true" />
              : <Fingerprint className="w-6 h-6 text-violet-500" aria-hidden="true" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm flex items-center gap-2">
              Fingerprint / Face ID
              {!hasBiometric && (
                <span className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-normal">
                  Setup required
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasBiometric ? 'Use your device biometrics to verify' : 'Register your device once to use this option'}
            </p>
          </div>
        </button>
      </div>

      <Button variant="ghost" className="w-full gap-2 text-xs" onClick={reset}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Scan a different QR
      </Button>
    </div>
  )

  // ── Password input panel ─────────────────────────────────────────────────
  const PasswordPanel = () => (
    <div className="space-y-4">
      <SessionBanner session={session!} />
      <div className="space-y-1.5">
        <Label htmlFor="pass-input">Session Password</Label>
        <Input
          id="pass-input"
          placeholder="Password shown by teacher"
          value={passwordCode}
          onChange={(e) => setPasswordCode(e.target.value.toUpperCase())}
          className="text-center text-lg font-mono tracking-widest uppercase h-12"
          onKeyDown={(e) => e.key === 'Enter' && passwordCode && passwordMutation.mutate()}
          autoFocus
        />
        <p className="text-xs text-muted-foreground text-center">
          Displayed alongside the QR code on the teacher's screen
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setVerifyMethod('pick')}>
          <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" />
          Back
        </Button>
        <Button
          variant="gradient" className="flex-1 gap-2"
          disabled={!passwordCode.trim()}
          loading={passwordMutation.isPending}
          onClick={() => passwordMutation.mutate()}
        >
          <KeyRound className="w-4 h-4" aria-hidden="true" />
          Confirm
        </Button>
      </div>
    </div>
  )

  // ── Biometric setup prompt (first time) ──────────────────────────────────
  const BiometricSetupPanel = () => (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
          <Fingerprint className="w-8 h-8 text-violet-500" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold">Register Your Device</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Register your fingerprint or Face ID once. After that, you can mark attendance with a single touch — no password needed.
          </p>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/50 text-left max-w-xs">
          <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Your biometric data never leaves your device. Only a cryptographic key is stored.
          </p>
        </div>
      </div>
      <RegisterDeviceButton onRegistered={() => setVerifyMethod('pick')} />
      <Button variant="ghost" className="w-full gap-2" onClick={() => setVerifyMethod('pick')}>
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Use password instead
      </Button>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold">Mark Attendance</h2>
        <p className="text-sm text-muted-foreground">
          Scan the QR code on your teacher's screen, or enter the session code manually
        </p>
      </div>

      {/* ── Step 1: How to get the session ─────────────────────────────── */}
      {!session && mode === 'choose' && (
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setMode('camera')}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Camera className="w-7 h-7 text-primary" aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">Scan QR Code</p>
              <p className="text-xs text-muted-foreground mt-0.5">Use your camera</p>
            </div>
          </button>
          <button onClick={() => setMode('manual')}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Keyboard className="w-7 h-7 text-primary" aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">Enter Code</p>
              <p className="text-xs text-muted-foreground mt-0.5">Type session code</p>
            </div>
          </button>
        </div>
      )}

      {/* Camera */}
      {!session && mode === 'camera' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {validateQRMutation.isPending ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="w-10 h-10 text-primary animate-spin" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Validating QR code…</p>
              </div>
            ) : (
              <QRScannerView onDecoded={handleQRDecoded} onFallback={() => setMode('manual')} />
            )}
            <p className="text-center">
              <button className="text-xs text-muted-foreground hover:text-primary transition-colors" onClick={() => setMode('manual')}>
                Camera not working? Enter the code manually →
              </button>
            </p>
            <Button variant="outline" className="w-full gap-2" onClick={reset}>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manual code entry */}
      {!session && mode === 'manual' && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-primary" aria-hidden="true" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-code">Session Code</Label>
              <Input
                id="session-code"
                placeholder="e.g. CS301-AB3X"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="text-center text-lg font-mono tracking-widest uppercase h-12"
                onKeyDown={(e) => e.key === 'Enter' && sessionCode && findMutation.mutate()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Enter the code shown on your teacher's screen
              </p>
            </div>
            <Button variant="gradient" className="w-full gap-2"
              disabled={!sessionCode.trim()} loading={findMutation.isPending}
              onClick={() => findMutation.mutate()}
            >
              Continue <BookOpen className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" className="w-full gap-2" onClick={() => setMode('choose')}>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Verify ─────────────────────────────────────────────── */}
      {session && (
        <Card>
          <CardContent className="pt-6">
            {verifyMethod === 'pick'      && <VerifyPicker />}
            {verifyMethod === 'password'  && <PasswordPanel />}
            {verifyMethod === 'biometric' && <BiometricSetupPanel />}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Register device button (inline, reusable) ───────────────────────────────
function RegisterDeviceButton({ onRegistered }: { onRegistered: () => void }) {
  const [busy, setBusy] = useState(false)

  const handleRegister = async () => {
    setBusy(true)
    try {
      await webauthnService.registerDevice()
      toast({ title: 'Device registered!', description: 'You can now use biometrics to mark attendance.', variant: 'success' })
      onRegistered()
    } catch (err) {
      const error = err as ApiError;
      const msg = error.response?.data?.message || error.message || ''
      if (!msg.toLowerCase().includes('cancel')) {
        toast({ title: 'Registration failed', description: msg || 'Could not register your device.', variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="gradient" className="w-full gap-2" loading={busy} onClick={handleRegister}>
      <Fingerprint className="w-4 h-4" aria-hidden="true" />
      Register This Device
    </Button>
  )
}
