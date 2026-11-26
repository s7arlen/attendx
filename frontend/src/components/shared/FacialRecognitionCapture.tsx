/**
 * Facial Recognition Capture Component
 * Handles face detection and registration for attendance verification
 */

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/hooks/useToast'
import {
  initializeFaceAPI,
  captureFaceDescriptor,
  captureFaceDescriptors,
  averageDescriptors,
  serializeDescriptor,
} from '@/services/facialRecognition.service'

interface FacialRecognitionCaptureProps {
  mode: 'register' | 'verify'
  onSuccess: (descriptor: number[]) => void
  onCancel: () => void
  isLoading?: boolean
}

export function FacialRecognitionCapture({
  mode,
  onSuccess,
  onCancel,
  isLoading = false,
}: FacialRecognitionCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [initialized, setInitialized] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [status, setStatus] = useState<'ready' | 'capturing' | 'processing' | 'success' | 'error'>('ready')
  const [errorMsg, setErrorMsg] = useState('')
  const [cameraAvailable, setCameraAvailable] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)

  // Initialize face-api and camera
  useEffect(() => {
    const init = async () => {
      try {
        // Check camera device availability (Fix #8)
        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasCamera = devices.some(device => device.kind === 'videoinput')
        
        if (!hasCamera) {
          throw new Error('No camera device found on this device')
        }

        // Initialize face-api models
        await initializeFaceAPI()

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
        }

        setInitialized(true)
      } catch (error: any) {
        const msg = error.message || 'Failed to initialize facial recognition'
        setErrorMsg(msg)
        setCameraAvailable(false)
        toast({
          title: 'Camera or Models Failed',
          description: msg,
          variant: 'destructive',
        })
      }
    }

    init()

    return () => {
      // Cleanup: stop camera stream (Fix #10)
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
      } catch (error) {
        console.error('Error stopping video stream:', error)
      }
    }
  }, [])

  const handleCapture = async () => {
    if (!videoRef.current || !initialized || capturing) return

    setCapturing(true)
    setStatus('capturing')

    try {
      const captureCount = mode === 'register' ? 3 : 1

      if (mode === 'register') {
        setStatus('capturing')
        const descriptors = await captureFaceDescriptors(videoRef.current, captureCount, 500)
        const averagedDescriptor = averageDescriptors(descriptors)
        const serialized = serializeDescriptor(averagedDescriptor)

        setStatus('success')
        onSuccess(serialized)
      } else {
        // Verify mode - single capture
        setStatus('processing')
        const descriptor = await captureFaceDescriptor(videoRef.current)

        if (descriptor) {
          const serialized = serializeDescriptor(descriptor)
          setStatus('success')
          onSuccess(serialized)
        } else {
          throw new Error('Failed to capture face')
        }
      }
    } catch (error: any) {
      const msg = error.message || 'Failed to capture face'
      setErrorMsg(msg)
      setStatus('error')
      toast({
        title: 'Capture Failed',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setCapturing(false)
    }
  }

  if (!cameraAvailable) {
    return (
      <Card className="border-red-500/30">
        <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold">Camera Not Available</h3>
            <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Please grant camera permissions or try a different device
            </p>
          </div>
          <Button variant="outline" onClick={onCancel}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!initialized) {
    return (
      <Card>
        <CardContent className="py-14 flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading facial recognition…</p>
        </CardContent>
      </Card>
    )
  }

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
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} // Mirror the video
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Face detection guides */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-48 h-48 rounded-full border-2 border-violet-500/60 shadow-2xl shadow-violet-950/20">
                {/* Corner markers */}
                <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-violet-400 rounded-tl-lg -translate-x-1 -translate-y-1" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-violet-400 rounded-tr-lg translate-x-1 -translate-y-1" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-violet-400 rounded-bl-lg -translate-x-1 translate-y-1" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-violet-400 rounded-br-lg translate-x-1 translate-y-1" />

                {/* Pulsing center dot */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1 h-1 bg-violet-400 rounded-full animate-pulse" />
                </div>
              </div>
            </div>

            {/* Status overlay */}
            {capturing && (
              <div className="absolute inset-0 bg-violet-500/10 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto" />
                  <p className="text-sm font-medium text-violet-100">
                    {status === 'capturing'
                      ? mode === 'register'
                        ? 'Capturing (3 frames)…'
                        : 'Capturing face…'
                      : 'Processing…'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="p-4 bg-card/50 backdrop-blur-sm border-t border-white/5">
            <p className="text-xs text-muted-foreground text-center">
              {mode === 'register'
                ? "Position your face in the circle. We'll capture 3 frames for better accuracy."
                : 'Look at the camera. Your face will be verified.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Error message */}
      {status === 'error' && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-200 dark:border-red-900/50">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* Success message */}
      {status === 'success' && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            {mode === 'register' ? 'Face registered successfully!' : 'Face verified successfully!'}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {status !== 'success' ? (
          <>
            <Button
              variant="gradient"
              className="flex-1 gap-2"
              disabled={capturing || !initialized || isLoading}
              loading={capturing}
              onClick={handleCapture}
            >
              <Camera className="w-4 h-4" />
              {mode === 'register' ? 'Register Face' : 'Verify Face'}
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              disabled={capturing || isLoading}
              onClick={onCancel}
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="gradient"
              className="flex-1"
              onClick={() => {
                // Component will handle the success via onSuccess callback
              }}
              disabled
            >
              <CheckCircle2 className="w-4 h-4" />
              Verified
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={onCancel}
            >
              <X className="w-4 h-4" />
              Close
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
