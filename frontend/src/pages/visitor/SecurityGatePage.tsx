import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import {
  Camera, Keyboard, CheckCircle2, XCircle, AlertCircle,
  LogIn, LogOut, Loader2, User2, Phone, Building2, QrCode,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { visitorService } from '@/services/visitor.service'
import { toast } from '@/hooks/useToast'
import { useSocket } from '@/hooks/useSocket'

type ScanMode  = 'choose' | 'camera' | 'manual'
type ScanResult = 'idle' | 'loading' | 'success' | 'invalid' | 'expired' | 'revoked' | 'duplicate' | 'denied'

interface ScanData {
  visitor?: { fullName: string; phone: string; email?: string; category: string; photo?: string }
  visit?: { status: string; purpose: string; hostId?: { name: string; department: string } }
  action?: 'entry' | 'exit'
  timestamp?: string
  message?: string
}

function QRScanner({ onDecoded, onFallback }: { onDecoded: (text: string) => void; onFallback: () => void }) {
  const startedRef  = useRef(false)
  const resolvedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    const scanner = new Html5Qrcode('gate-viewfinder')
    scanner.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 240, height: 240 } },
      (text) => {
        if (resolvedRef.current) return
        resolvedRef.current = true
        scanner.stop().catch(() => {})
        onDecoded(text)
      },
      () => {}
    ).catch(() => { toast({ title: 'Camera unavailable', variant: 'destructive' }); onFallback() })
    return () => { scanner.stop().catch(() => {}) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[280px] rounded-2xl overflow-hidden border-4 border-primary/30 shadow-lg bg-black">
        <div id="gate-viewfinder" className="w-full" style={{ minHeight: 260 }} />
        <div className="absolute inset-0 pointer-events-none">
          <span className="absolute top-4 left-4  w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-lg" />
          <span className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-lg" />
          <span className="absolute bottom-4 left-4  w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-lg" />
          <span className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-lg" />
          <span className="absolute left-8 right-8 top-1/2 h-0.5 bg-primary/80 animate-pulse" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Point camera at visitor's QR pass</p>
    </div>
  )
}

export default function SecurityGatePage() {
  const [mode, setMode]           = useState<ScanMode>('choose')
  const [action, setAction]       = useState<'entry' | 'exit'>('entry')
  const [manualCode, setManualCode] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult>('idle')
  const [scanData, setScanData]   = useState<ScanData>({})

  const socket = useSocket()
  useEffect(() => {
    socket.socket?.emit('join:visitor-gate')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = useCallback(() => {
    setMode('choose'); setScanResult('idle'); setScanData({})
    setManualCode(''); scanMutation.reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scanMutation = useMutation({
    mutationFn: (passCode: string) => visitorService.scanQR({ passCode: passCode.trim().toUpperCase(), action }),
    onSuccess: (data) => {
      setScanResult('success')
      setScanData({ visitor: data.data?.visitor, visit: data.data?.visit, action: data.data?.action, timestamp: data.data?.timestamp })
      toast({ title: action === 'entry' ? 'Entry Recorded' : 'Exit Recorded', variant: 'success' })
    },
    onError: (err: any) => {
      const r = err.response?.data?.scanResult || 'invalid'
      const msg = err.response?.data?.message || 'Scan failed'
      setScanResult(r as ScanResult)
      setScanData({ visitor: err.response?.data?.visitor, message: msg })
      toast({ title: 'Scan failed', description: msg, variant: 'destructive' })
    },
  })

  const handleQRDecoded = (text: string) => {
    try {
      const payload = JSON.parse(text)
      if (!payload.passCode) throw new Error('bad')
      setMode('choose')
      setScanResult('loading')
      scanMutation.mutate(payload.passCode)
    } catch {
      toast({ title: 'Invalid QR', description: 'Not a valid visitor pass QR.', variant: 'destructive' })
      setMode('choose')
    }
  }

  const resultIcon = {
    success: <CheckCircle2 className="w-12 h-12 text-emerald-500" />,
    invalid: <XCircle className="w-12 h-12 text-red-500" />,
    expired: <AlertCircle className="w-12 h-12 text-amber-500" />,
    revoked: <XCircle className="w-12 h-12 text-red-500" />,
    duplicate: <AlertCircle className="w-12 h-12 text-amber-500" />,
    denied: <XCircle className="w-12 h-12 text-red-500" />,
    loading: <Loader2 className="w-12 h-12 text-primary animate-spin" />,
    idle: null,
  }

  const resultColor = {
    success: 'border-emerald-200 bg-emerald-500/5',
    invalid: 'border-red-200 bg-red-500/5',
    expired: 'border-amber-200 bg-amber-500/5',
    revoked: 'border-red-200 bg-red-500/5',
    duplicate: 'border-amber-200 bg-amber-500/5',
    denied: 'border-red-200 bg-red-500/5',
    loading: 'border-border',
    idle: 'border-border',
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold">Security Gate Scanner</h2>
        <p className="text-sm text-muted-foreground">Scan visitor QR passes for campus entry/exit</p>
      </div>

      {/* Action toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setAction('entry')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${action === 'entry' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-border text-muted-foreground'}`}
        >
          <LogIn className="w-4 h-4" /> Entry
        </button>
        <button
          onClick={() => setAction('exit')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${action === 'exit' ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-border text-muted-foreground'}`}
        >
          <LogOut className="w-4 h-4" /> Exit
        </button>
      </div>

      {/* Result card */}
      {scanResult !== 'idle' && (
        <Card className={`border-2 ${resultColor[scanResult]}`}>
          <CardContent className="pt-6 pb-6">
            {scanResult === 'loading' ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Verifying pass…</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2">
                  {resultIcon[scanResult]}
                  <p className="font-semibold capitalize">{scanResult === 'success' ? `${scanData.action} recorded` : scanData.message}</p>
                </div>
                {scanData.visitor && (
                  <div className="rounded-xl bg-background border p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {scanData.visitor.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{scanData.visitor.fullName}</p>
                        <Badge variant="default" className="text-[10px]">{scanData.visitor.category}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" /> {scanData.visitor.phone}
                    </div>
                    {scanData.visit?.hostId && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        Meeting {scanData.visit.hostId.name} · {scanData.visit.hostId.department}
                      </div>
                    )}
                    {scanData.visit?.purpose && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User2 className="w-3 h-3" /> {scanData.visit.purpose}
                      </div>
                    )}
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={reset}>Scan Another</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scanner */}
      {scanResult === 'idle' && (
        <>
          {mode === 'choose' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMode('camera')}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Camera className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">Scan QR</p>
                  <p className="text-xs text-muted-foreground">Use camera</p>
                </div>
              </button>
              <button
                onClick={() => setMode('manual')}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Keyboard className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">Enter Code</p>
                  <p className="text-xs text-muted-foreground">Type pass code</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'camera' && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <QRScanner onDecoded={handleQRDecoded} onFallback={() => setMode('manual')} />
                <p className="text-center">
                  <button className="text-xs text-muted-foreground hover:text-primary" onClick={() => setMode('manual')}>
                    Use manual code instead →
                  </button>
                </p>
              </CardContent>
            </Card>
          )}

          {mode === 'manual' && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><QrCode className="w-4 h-4 text-primary" />Enter Pass Code</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="VIS-XXXXXX"
                  className="text-center text-lg font-mono tracking-widest uppercase h-12"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && manualCode && scanMutation.mutate(manualCode)}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setMode('choose')}>Back</Button>
                  <Button
                    variant="gradient" className="flex-1"
                    disabled={!manualCode.trim()}
                    loading={scanMutation.isPending}
                    onClick={() => scanMutation.mutate(manualCode)}
                  >
                    {action === 'entry' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                    Record {action}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
