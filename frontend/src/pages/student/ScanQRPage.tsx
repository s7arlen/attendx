import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import {
  QrCode, CheckCircle2, ArrowLeft, Camera, Keyboard,
  Loader2, Fingerprint, ShieldAlert, MapPin, BookOpen, Eye,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FacialRecognitionCapture } from '@/components/shared/FacialRecognitionCapture'
import { attendanceService } from '@/services/attendance.service'
import { webauthnService } from '@/services/webauthn.service'
import { useSocket } from '@/hooks/useSocket'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { ApiError } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────
type Mode = 'choose' | 'camera' | 'manual'
// Steps after QR is validated:
// 'registering' → device not registered yet, show register prompt
// 'biometric'   → device registered, fire biometric immediately
// 'face'        → facial recognition verification
type Step = 'registering' | 'biometric' | 'face' | 'verify-method'

interface ValidatedSession {
  id:          string
  subject?:    { _id?: string; subjectName?: string; subjectCode?: string }
  qrToken:     string
  sessionType?: string
  venue?:      string | null
  title?:      string | null
}

// ─── QR Scanner ──────────────────────────────────────────────────────────────
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
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-[290px] rounded-3xl overflow-hidden border-2 border-rose-500/40 shadow-2xl shadow-rose-950/40 bg-black">
        <div id="qr-viewfinder" className="w-full" style={{ minHeight: 270 }} />
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <span className="absolute top-4 left-4  w-8 h-8 border-t-2 border-l-2 border-rose-400 rounded-tl-xl drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          <span className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-rose-400 rounded-tr-xl drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          <span className="absolute bottom-4 left-4  w-8 h-8 border-b-2 border-l-2 border-rose-400 rounded-bl-xl drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          <span className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-rose-400 rounded-br-xl drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          <span className="absolute left-6 right-6 top-1/2 h-0.5 gradient-sunset shadow-[0_0_12px_#F43F5E] animate-pulse" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center px-4 font-medium">
        Align the QR code within the frame to scan
      </p>
    </div>
  )
}

// ─── Session Banner ───────────────────────────────────────────────────────────
function SessionBanner({ session }: { session: ValidatedSession }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Session verified</p>
        <p className="font-semibold text-sm truncate">
          {session.title || session.subject?.subjectName || 'Session found'}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {session.subject?.subjectCode && <span className="font-mono">{session.subject.subjectCode}</span>}
          {session.sessionType && <span className="capitalize">{session.sessionType}</span>}
          {session.venue && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />{session.venue}
            </span>
          )}
        </div>
      </div>
      <Badge variant="success">Active</Badge>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ScanQRPage() {
  const [mode,                    setMode]                    = useState<Mode>('choose')
  const [step,                    setStep]                    = useState<Step>('biometric')
  const [verificationMethod,      setVerificationMethod]      = useState<'biometric' | 'face' | null>(null)
  const [sessionCode,             setSessionCode]             = useState('')
  const [session,                 setSession]                 = useState<ValidatedSession | null>(null)
  const [showDone,                setShowDone]                = useState(false)
  const [validating,              setValidating]              = useState(false)
  const [biometricBusy,           setBiometricBusy]           = useState(false)
  const [registerBusy,            setRegisterBusy]            = useState(false)
  const [facialRecognitionBusy,   setFacialRecognitionBusy]   = useState(false)
  const [lateEntry,               setLateEntry]               = useState(false)

  const { user, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const socket   = useSocket()

  const reset = useCallback(() => {
    setMode('choose')
    setStep('biometric')
    setVerificationMethod(null)
    setSession(null)
    setSessionCode('')
    setShowDone(false)
    setValidating(false)
    setBiometricBusy(false)
    setLateEntry(false)
    setFacialRecognitionBusy(false)
  }, [])

  // Listen for session:ended mid-verification
  useEffect(() => {
    if (!session) return
    socket.watchSession(session.id)
    const off = socket.onEvent('session:ended', () => {
      toast({
        title: 'Session ended by teacher',
        description: 'Your attendance was not recorded.',
        variant: 'destructive',
      })
      reset()
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  // ── After session validated — decide step ────────────────────────────────
  const proceedWithSession = (validated: ValidatedSession) => {
    setSession(validated)
    // Check if device is registered — use store flag for speed
    if (user?.hasWebAuthn) {
      setStep('verify-method')
    } else {
      setStep('registering')
    }
  }

  // ── Validate QR payload ──────────────────────────────────────────────────
  const validateQR = async (sessionId: string, secureToken: string) => {
    setValidating(true)
    try {
      const res = await attendanceService.validateQR({ sessionId, secureToken })
      if (res.alreadyMarked) {
        toast({ title: 'Already marked', description: 'Attendance already recorded for this session.', variant: 'destructive' })
        setMode('choose')
        return
      }
      proceedWithSession({
        id:          res.session?.id || sessionId,
        subject:     res.session?.subject,
        qrToken:     secureToken,
        sessionType: res.session?.sessionType,
        venue:       res.session?.venue,
        title:       res.session?.title,
      })
    } catch (err) {
      const error = err as ApiError
      toast({ title: 'QR expired or invalid', description: error.response?.data?.message || 'Ask your teacher to refresh the QR.', variant: 'destructive' })
      setMode('choose')
    } finally {
      setValidating(false)
    }
  }

  const handleQRDecoded = (text: string) => {
    try {
      const payload = JSON.parse(text)
      if (!payload.sessionId || !payload.secureToken) throw new Error('bad')
      validateQR(payload.sessionId, payload.secureToken)
    } catch {
      toast({ title: 'Unrecognised QR', description: 'Not an AttendX QR. Try entering the code manually.', variant: 'destructive' })
      setMode('choose')
    }
  }

  // ── Manual session code lookup ───────────────────────────────────────────
  const findByCode = async () => {
    if (!sessionCode.trim()) return
    setValidating(true)
    try {
      const res = await attendanceService.findSessionByCode(sessionCode.trim().toUpperCase())
      if (res.alreadyMarked) {
        toast({ title: 'Already marked', variant: 'destructive' })
        return
      }
      proceedWithSession({
        id:          res.session.id,
        subject:     res.session.subject,
        qrToken:     res.session.qrToken,
        sessionType: res.session.sessionType,
        venue:       res.session.venue,
        title:       res.session.title,
      })
    } catch (err) {
      const error = err as ApiError
      toast({ title: 'Session not found', description: error.response?.data?.message || 'Check the code and try again.', variant: 'destructive' })
    } finally {
      setValidating(false)
    }
  }

  // ── Trigger biometric ────────────────────────────────────────────────────
  const triggerBiometric = async (s?: ValidatedSession) => {
    const target = s || session
    if (!target) return
    setBiometricBusy(true)
    try {
      const result = await webauthnService.verifyAttendanceWithBiometric({
        sessionId:   target.id,
        subjectId:   target.subject?._id || '',
        secureToken: target.qrToken,
      })
      setLateEntry(result.data?.isLate || false)
      setShowDone(true)
      const msg = result.data?.isLate ? 'Attendance marked (late entry accepted) ✅' : 'Attendance marked!'
      toast({ title: msg, variant: 'success' })
    } catch (err) {
      const error = err as ApiError
      const msg = error.response?.data?.message || error.message || ''
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('user')) {
        // User cancelled the browser prompt — stay on page, let them retry
        toast({ title: 'Biometric cancelled', description: 'Tap the button to try again.', variant: 'info' as any })
      } else {
        toast({ title: 'Biometric failed', description: msg || 'Please try again.', variant: 'destructive' })
      }
    } finally {
      setBiometricBusy(false)
    }
  }

  // ── Register device then immediately verify ──────────────────────────────
  const registerThenVerify = async () => {
    setRegisterBusy(true)
    try {
      await webauthnService.registerDevice()
      toast({ title: 'Device registered!', description: 'Now verifying your attendance…', variant: 'success' })
      // Update user store so hasWebAuthn = true for future sessions
      updateUser({ hasWebAuthn: true })
      setStep('biometric')
      await triggerBiometric()
    } catch (err) {
      const error = err as ApiError
      const msg = error.response?.data?.message || error.message || ''
      if (!msg.toLowerCase().includes('cancel')) {
        toast({ title: 'Registration failed', description: msg || 'Could not register your device.', variant: 'destructive' })
      }
    } finally {
      setRegisterBusy(false)
    }
  }

  // ── Trigger facial recognition ──────────────────────────────────────────
  const triggerFacialRecognition = async (s?: ValidatedSession) => {
    const target = s || session
    if (!target) return
    setFacialRecognitionBusy(true)
    setStep('face')
    // The FacialRecognitionCapture component will call onSuccess with descriptor
  }

  const handleFaceVerified = async (faceDescriptor: number[]) => {
    const target = session
    if (!target) return
    setFacialRecognitionBusy(true)
    try {
      const result = await attendanceService.verifyAttendanceWithFace({
        sessionId:   target.id,
        subjectId:   target.subject?._id || '',
        secureToken: target.qrToken,
        faceDescriptor,
      })
      setLateEntry(result.data?.isLate || false)
      setShowDone(true)
      const msg = result.data?.isLate ? 'Attendance marked (late entry accepted) ✅' : 'Attendance marked!'
      toast({ title: msg, variant: 'success' })
    } catch (err) {
      const error = err as ApiError
      const msg = error.response?.data?.message || error.message || 'Facial recognition failed'
      toast({ title: 'Verification failed', description: msg, variant: 'destructive' })
      setStep('verify-method')
    } finally {
      setFacialRecognitionBusy(false)
    }
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (showDone) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card className="border-emerald-500/30">
          <CardContent className="py-10 flex flex-col items-center gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Attendance Marked</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Recorded for{' '}
                <span className="font-medium text-foreground">
                  {session?.title || session?.subject?.subjectName || 'your session'}
                </span>
              </p>
              {session?.sessionType && (
                <p className="text-xs text-muted-foreground mt-1">
                  {session.sessionType.charAt(0).toUpperCase() + session.sessionType.slice(1)}
                  {session.venue && <> · <MapPin className="w-3 h-3 inline" /> {session.venue}</>}
                </p>
              )}
              {lateEntry && (
                <span className="inline-block mt-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                  Late entry accepted
                </span>
              )}
              <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-violet-600">
                <Fingerprint className="w-3.5 h-3.5" />
                Verified via biometrics
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button
                variant="gradient"
                className="w-full gap-2"
                onClick={() => navigate(`/student/receipt/${session?.id}`)}
              >
                <CheckCircle2 className="w-4 h-4" /> View Attendance Receipt
              </Button>
              <Button variant="outline" onClick={reset}>Mark Another</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold">Mark Attendance</h2>
        <p className="text-sm text-muted-foreground">
          Scan the QR code on your teacher's screen, or enter the session code manually
        </p>
      </div>

      {/* ── Step 1: Choose how to get the session ──────────────────────── */}
      {!session && !validating && mode === 'choose' && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMode('camera')}
            className="flex flex-col items-center gap-3 p-6 rounded-3xl glass-card glass-card-hover border border-white/60 dark:border-white/[0.08] shadow-sm group"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20 flex items-center justify-center group-hover:scale-105 group-hover:bg-rose-500/20 transition-all duration-200">
              <Camera className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="font-bold text-sm text-foreground">Scan QR Code</p>
              <p className="text-xs text-muted-foreground mt-0.5">Use your camera</p>
            </div>
          </button>
          <button
            onClick={() => setMode('manual')}
            className="flex flex-col items-center gap-3 p-6 rounded-3xl glass-card glass-card-hover border border-white/60 dark:border-white/[0.08] shadow-sm group"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20 flex items-center justify-center group-hover:scale-105 group-hover:bg-amber-500/20 transition-all duration-200">
              <Keyboard className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="font-bold text-sm text-foreground">Enter Code</p>
              <p className="text-xs text-muted-foreground mt-0.5">Type session code</p>
            </div>
          </button>
        </div>
      )}

      {/* Validating spinner */}
      {validating && (
        <Card>
          <CardContent className="py-14 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Validating session…</p>
          </CardContent>
        </Card>
      )}

      {/* Camera view */}
      {!session && !validating && mode === 'camera' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <QRScannerView onDecoded={handleQRDecoded} onFallback={() => setMode('manual')} />
            <p className="text-center">
              <button
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMode('manual')}
              >
                Camera not working? Enter the code manually →
              </button>
            </p>
            <Button variant="outline" className="w-full gap-2" onClick={reset}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manual code entry */}
      {!session && !validating && mode === 'manual' && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-primary" />
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
                onKeyDown={(e) => e.key === 'Enter' && sessionCode && findByCode()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Enter the code shown on your teacher's screen
              </p>
            </div>
            <Button
              variant="gradient"
              className="w-full gap-2"
              disabled={!sessionCode.trim()}
              loading={validating}
              onClick={findByCode}
            >
              Continue <BookOpen className="w-4 h-4" />
            </Button>
            <Button variant="ghost" className="w-full gap-2" onClick={() => setMode('choose')}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Biometric verification ─────────────────────────────── */}
      {session && !showDone && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <SessionBanner session={session} />

            {/* Verification method choice */}
            {step === 'verify-method' && (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <p className="font-semibold text-base">Choose Verification Method</p>
                  <p className="text-sm text-muted-foreground mt-1">Select how you want to verify your attendance</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setVerificationMethod('biometric')
                      setStep('biometric')
                      triggerBiometric()
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl glass-card glass-card-hover border border-white/60 dark:border-white/[0.08] group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20 flex items-center justify-center group-hover:scale-105 transition-all">
                      <Fingerprint className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-xs text-foreground">Biometric</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Fingerprint / Face ID</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setVerificationMethod('face')
                      triggerFacialRecognition()
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl glass-card glass-card-hover border border-white/60 dark:border-white/[0.08] group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-500 ring-1 ring-cyan-500/20 flex items-center justify-center group-hover:scale-105 transition-all">
                      <Eye className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-xs text-foreground">Facial Recognition</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Verify with face</p>
                    </div>
                  </button>
                </div>

                <Button variant="ghost" className="w-full gap-2 text-xs" onClick={reset}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Scan a different QR
                </Button>
              </div>
            )}

            {/* Not registered yet — register first */}
            {step === 'registering' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                    <Fingerprint className="w-8 h-8 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-base">Register Your Biometric</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      AttendX requires biometric verification to mark attendance.
                      Register your fingerprint or Face ID once — takes 5 seconds.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/50 text-left max-w-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Your biometric data never leaves your device. Only a cryptographic key is stored on the server.
                    </p>
                  </div>
                </div>

                <Button
                  variant="gradient"
                  className="w-full gap-2 h-12"
                  loading={registerBusy}
                  onClick={registerThenVerify}
                >
                  <Fingerprint className="w-5 h-5" />
                  Register & Mark Attendance
                </Button>

                <Button variant="ghost" className="w-full gap-2" onClick={reset}>
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              </div>
            )}

            {/* Device registered — show biometric button */}
            {step === 'biometric' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                    biometricBusy
                      ? 'bg-violet-500/20 ring-4 ring-violet-500/30 ring-offset-2 animate-pulse'
                      : 'bg-violet-500/10 hover:bg-violet-500/20'
                  }`}>
                    {biometricBusy
                      ? <Loader2 className="w-9 h-9 text-violet-500 animate-spin" />
                      : <Fingerprint className="w-9 h-9 text-violet-500" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-base">
                      {biometricBusy ? 'Waiting for biometric…' : 'Verify with Biometrics'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {biometricBusy
                        ? 'Use your fingerprint or Face ID to confirm'
                        : 'Touch your fingerprint sensor or look at the camera'
                      }
                    </p>
                  </div>
                </div>

                {!biometricBusy && (
                  <Button
                    variant="gradient"
                    className="w-full gap-2 h-12"
                    onClick={() => triggerBiometric()}
                  >
                    <Fingerprint className="w-5 h-5" />
                    Verify Fingerprint / Face ID
                  </Button>
                )}

                <Button variant="ghost" className="w-full gap-2 text-xs" onClick={reset}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Scan a different QR
                </Button>
              </div>
            )}

            {/* Facial Recognition */}
            {step === 'face' && (
              <div className="space-y-4">
                <FacialRecognitionCapture
                  mode="verify"
                  onSuccess={handleFaceVerified}
                  onCancel={() => setStep('verify-method')}
                  isLoading={facialRecognitionBusy}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
