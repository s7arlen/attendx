/**
 * Facial Recognition Capture Component
 * Performs randomized active liveness challenges (blink, head turns, mouth open)
 * and captures multi-frame telemetry + compressed snapshots for server verification.
 */

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, AlertCircle, CheckCircle2, X, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/hooks/useToast'
import {
  initializeFaceAPI,
  detectLiveFaceSample,
  isLivenessActionSatisfied,
} from '@/services/facialRecognition.service'
import type { LivenessAction, LivenessFrameTelemetry, LivenessProof } from '@/types'

interface FacialRecognitionCaptureProps {
  mode: 'register' | 'verify'
  livenessActions?: LivenessAction[]
  onSuccess: (proof: LivenessProof) => void
  onCancel: () => void
  isLoading?: boolean
}

const ACTION_PROMPTS: Record<LivenessAction, { title: string; hint: string }> = {
  blink: {
    title: 'Blink both eyes clearly',
    hint: 'Close and open both eyes naturally while facing the camera.',
  },
  turn_left: {
    title: 'Turn head slightly LEFT ←',
    hint: 'Gently turn your head to your left so your profile shifts.',
  },
  turn_right: {
    title: 'Turn head slightly RIGHT →',
    hint: 'Gently turn your head to your right so your profile shifts.',
  },
  open_mouth: {
    title: 'Open your mouth briefly',
    hint: 'Open your mouth wide enough for the landmark check.',
  },
}

const DEFAULT_ACTIONS: LivenessAction[] = ['blink', 'turn_left']

export function FacialRecognitionCapture({
  mode,
  livenessActions,
  onSuccess,
  onCancel,
  isLoading = false,
}: FacialRecognitionCaptureProps) {
  const actions = livenessActions?.length ? livenessActions : DEFAULT_ACTIONS
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cancelledCaptureRef = useRef(false)

  const [initialized, setInitialized] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [status, setStatus] = useState<'ready' | 'capturing' | 'processing' | 'success' | 'error'>('ready')
  const [stepIndex, setStepIndex] = useState<number>(-1) // -1 = waiting, 0 = baseline, 1..N = actions
  const [liveHint, setLiveHint] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [initErrorType, setInitErrorType] = useState<'camera' | 'models' | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    const stopExistingStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }

    const init = async () => {
      setInitialized(false)
      setInitErrorType(null)
      setErrorMsg('')

      try {
        await initializeFaceAPI()
      } catch (error: unknown) {
        if (cancelled) return
        const msg = error instanceof Error ? error.message : 'Facial recognition models failed to load.'
        setErrorMsg(msg)
        setInitErrorType('models')
        toast({ title: 'Model Load Failed', description: msg, variant: 'destructive' })
        return
      }

      if (cancelled) return

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not supported in this browser or requires HTTPS.')
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        streamRef.current = stream
        setInitialized(true)
      } catch (error: unknown) {
        if (cancelled) return
        const errObj = error as { name?: string; message?: string }
        const msg =
          errObj?.name === 'NotAllowedError'
            ? 'Camera permission was denied. Please allow camera access in your browser settings.'
            : errObj?.name === 'NotFoundError'
              ? 'No camera device was found on this device.'
              : errObj?.message || 'Failed to access camera.'
        setErrorMsg(msg)
        setInitErrorType('camera')
        toast({ title: 'Camera Failed', description: msg, variant: 'destructive' })
      }
    }

    init()

    return () => {
      cancelled = true
      cancelledCaptureRef.current = true
      try {
        stopExistingStream()
      } catch (error) {
        console.error('Error stopping video stream:', error)
      }
    }
  }, [retryKey])

  useEffect(() => {
    if (!initialized || !videoRef.current || !streamRef.current) return
    const videoEl = videoRef.current
    videoEl.srcObject = streamRef.current
    videoEl.play().catch(() => {})
  }, [initialized])

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const handleStartLiveness = async () => {
    if (!videoRef.current || !initialized || capturing) return

    cancelledCaptureRef.current = false
    setCapturing(true)
    setErrorMsg('')
    setStatus('capturing')
    setStepIndex(0)
    setLiveHint('Hold still and look straight at the camera…')

    const startTime = Date.now()

    try {
      // Phase 0: Capture clean neutral frontal baseline (eyes open, centered)
      let baselineFrame: LivenessFrameTelemetry | null = null
      const baselineDeadline = Date.now() + 10_000

      while (!baselineFrame && Date.now() < baselineDeadline) {
        if (cancelledCaptureRef.current || !videoRef.current) throw new Error('Capture cancelled')
        try {
          const sample = await detectLiveFaceSample(videoRef.current, canvasRef.current)
          if (sample.ear < 0.20) {
            setLiveHint('Keep both eyes open while looking straight ahead…')
          } else if (sample.yawRatio < 0.34 || sample.yawRatio > 0.66) {
            setLiveHint('Face straight toward the camera first…')
          } else {
            baselineFrame = { phase: 'baseline', ...sample }
            break
          }
        } catch (err: unknown) {
          setLiveHint(err instanceof Error ? err.message : 'Center your face inside the circle…')
        }
        await sleep(220)
      }

      if (!baselineFrame) {
        throw new Error('Could not capture a clear neutral face frame. Look straight at the camera and retry.')
      }

      const frames: LivenessFrameTelemetry[] = [baselineFrame]

      // Phases 1..N: Execute each randomized liveness challenge live
      for (let idx = 0; idx < actions.length; idx++) {
        const action = actions[idx]
        setStepIndex(idx + 1)
        setLiveHint(ACTION_PROMPTS[action].hint)

        // Small gap so timestamps are >= 250ms apart and user reads the prompt
        await sleep(320)

        let actionFrame: LivenessFrameTelemetry | null = null
        const stepDeadline = Date.now() + 14_000

        while (!actionFrame && Date.now() < stepDeadline) {
          if (cancelledCaptureRef.current || !videoRef.current) throw new Error('Capture cancelled')
          try {
            const sample = await detectLiveFaceSample(videoRef.current, canvasRef.current)
            if (isLivenessActionSatisfied(action, baselineFrame, sample)) {
              actionFrame = { phase: action, ...sample }
              break
            }
          } catch {
            // Keep polling within step window
          }
          await sleep(180)
        }

        if (!actionFrame) {
          throw new Error(`Liveness step timed out: ${ACTION_PROMPTS[action].title}. Please try again.`)
        }

        frames.push(actionFrame)
      }

      setStatus('processing')
      setLiveHint('Verifying live capture with server…')

      const totalDurationMs = Date.now() - startTime
      setStatus('success')
      onSuccess({ frames, totalDurationMs })
    } catch (error: unknown) {
      if (cancelledCaptureRef.current) return
      const msg = error instanceof Error ? error.message : 'Liveness verification failed'
      setErrorMsg(msg)
      setStatus('error')
      setStepIndex(-1)
      toast({ title: 'Liveness Check Failed', description: msg, variant: 'destructive' })
    } finally {
      setCapturing(false)
    }
  }

  if (initErrorType) {
    const isCameraError = initErrorType === 'camera'
    return (
      <Card className="border-red-500/30">
        <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold">
              {isCameraError ? 'Camera Not Available' : 'Facial Recognition Models Failed'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {isCameraError
                ? 'Please grant camera permissions or try a different device.'
                : 'Check your internet connection and tap Retry.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="gradient" onClick={() => setRetryKey((k) => k + 1)}>
              Retry
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!initialized) {
    return (
      <Card>
        <CardContent className="py-14 flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading live facial anti-spoofing…</p>
        </CardContent>
      </Card>
    )
  }

  const currentPrompt =
    stepIndex === 0
      ? 'Look straight at the camera (Neutral)'
      : stepIndex > 0 && stepIndex <= actions.length
        ? `Step ${stepIndex}/${actions.length}: ${ACTION_PROMPTS[actions[stepIndex - 1]].title}`
        : mode === 'register'
          ? 'Ready for live liveness enrollment'
          : 'Ready for live liveness check'

  return (
    <div className="space-y-4">
      <Card className="border-violet-500/30 overflow-hidden">
        <CardContent className="p-0 relative">
          {/* Video stream */}
          <div className="relative w-full bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Face detection oval guide */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className={`relative w-48 h-56 rounded-full border-2 transition-colors ${
                capturing ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.35)]' : 'border-violet-500/60'
              }`}>
                <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-violet-400 rounded-tl-lg -translate-x-1 -translate-y-1" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-violet-400 rounded-tr-lg translate-x-1 -translate-y-1" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-violet-400 rounded-bl-lg -translate-x-1 translate-y-1" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-violet-400 rounded-br-lg translate-x-1 translate-y-1" />
              </div>
            </div>

            {/* Live challenge prompt banner */}
            <div className="absolute top-3 left-3 right-3 pointer-events-none">
              <div className="bg-black/75 backdrop-blur-md text-white rounded-xl px-3.5 py-2.5 border border-white/15 text-center">
                <p className="text-sm font-semibold flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  {currentPrompt}
                </p>
                {liveHint && (
                  <p className="text-[11px] text-white/80 mt-0.5">{liveHint}</p>
                )}
              </div>
            </div>

            {/* Step progress indicators */}
            {capturing && (
              <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none">
                {[0, ...actions.map((_, idx) => idx + 1)].map((idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx < stepIndex
                        ? 'w-6 bg-emerald-400'
                        : idx === stepIndex
                          ? 'w-8 bg-violet-400 animate-pulse'
                          : 'w-4 bg-white/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-3.5 bg-card/60 backdrop-blur-sm border-t border-white/5">
            <p className="text-xs text-muted-foreground text-center">
              {mode === 'register'
                ? 'Active liveness is required during enrollment. Static photos or screens are rejected.'
                : 'Complete the randomized on-screen liveness steps to prove live presence.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {status === 'error' && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-200 dark:border-red-900/50">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-400">{errorMsg}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            {mode === 'register' ? 'Liveness passed — saving enrollment…' : 'Liveness passed — submitting verification…'}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {status !== 'success' ? (
          <>
            <Button
              variant="gradient"
              className="flex-1 gap-2"
              disabled={capturing || !initialized || isLoading}
              loading={capturing || isLoading}
              onClick={handleStartLiveness}
            >
              <Camera className="w-4 h-4" />
              {mode === 'register' ? 'Start Live Enrollment' : 'Start Live Verification'}
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              disabled={capturing || isLoading}
              onClick={() => {
                cancelledCaptureRef.current = true
                onCancel()
              }}
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="outline" className="w-full gap-2" disabled={isLoading} onClick={onCancel}>
            <X className="w-4 h-4" />
            Close
          </Button>
        )}
      </div>
    </div>
  )
}
