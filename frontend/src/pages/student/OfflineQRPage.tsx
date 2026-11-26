/**
 * OfflineQRPage — Scan live classroom QR offline, then complete live facial liveness verification when syncing online.
 */
import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { WifiOff, Wifi, CloudUpload, CheckCircle, AlertCircle, Trash2, QrCode, Clock, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FacialRecognitionCapture } from '@/components/shared/FacialRecognitionCapture'
import { toast } from '@/hooks/useToast'
import { attendanceService } from '@/services/attendance.service'
import type { LivenessAction, LivenessProof, ApiError } from '@/types'

const STORAGE_KEY = 'attendx_offline_qr_records'

interface OfflineRecord {
  id: string
  sessionId: string
  qrToken: string
  subjectName: string
  timestamp: string
  latitude?: number
  longitude?: number
  synced: boolean
  syncError?: string
}

function getOfflineRecords(): OfflineRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function saveOfflineRecords(records: OfflineRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return isOnline
}

const getCoords = async (): Promise<{ latitude?: number; longitude?: number }> => {
  if (!navigator.geolocation) return {}
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 5000 }
    )
  })
}

export default function OfflineQRPage() {
  const isOnline = useOnlineStatus()
  const [records, setRecords] = useState<OfflineRecord[]>(getOfflineRecords)
  const [scanning, setScanning] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [tab, setTab] = useState<'capture' | 'queue'>('capture')
  const [pendingVerify, setPendingVerify] = useState<{
    record: OfflineRecord
    challengeToken: string
    livenessActions: LivenessAction[]
  } | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    if (!scanning) return
    let active = true
    const scanner = new Html5Qrcode('offline-qr-viewfinder')
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 220, height: 220 } },
      async (text) => {
        if (!active) return
        active = false
        scanner.stop().catch(() => {})
        setScanning(false)
        try {
          const payload = JSON.parse(text)
          if (!payload.sessionId || !payload.secureToken) throw new Error('Invalid AttendX QR')

          const existing = records.find(r => r.sessionId === payload.sessionId)
          if (existing) {
            toast({ title: 'QR already queued for this session', variant: 'destructive' })
            setTab('queue')
            return
          }

          const coords = await getCoords()
          const next: OfflineRecord = {
            id: Date.now().toString(),
            sessionId: payload.sessionId,
            qrToken: payload.secureToken,
            subjectName: payload.subjectCode || 'Classroom Session',
            timestamp: new Date().toISOString(),
            ...coords,
            synced: false,
          }
          const updated = [...records, next]
          setRecords(updated)
          saveOfflineRecords(updated)
          toast({ title: 'Classroom QR saved offline', description: 'Live facial liveness check will run when syncing online.', variant: 'success' })
          setTab('queue')
        } catch {
          toast({ title: 'Invalid QR Code', description: 'Please scan the official AttendX projector QR.', variant: 'destructive' })
        }
      },
      () => {}
    ).catch(() => {
      setScanning(false)
      toast({ title: 'Camera unavailable', description: 'Grant camera permissions to scan offline QR codes.', variant: 'destructive' })
    })

    return () => {
      active = false
      scanner.stop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning])

  const startSyncRecord = async (record: OfflineRecord) => {
    if (!isOnline) {
      toast({ title: 'No internet connection', description: 'Connect to internet to verify and sync.', variant: 'destructive' })
      return
    }
    setSyncing(true)
    try {
      const challenge = await attendanceService.beginOfflineSync({
        sessionId: record.sessionId,
        qrToken: record.qrToken,
      })
      setPendingVerify({
        record,
        challengeToken: challenge.challengeToken,
        livenessActions: challenge.livenessActions,
      })
    } catch (err) {
      const error = err as ApiError
      const msg = error.response?.data?.message || 'Could not start offline sync verification'
      const updated = records.map(r => r.id === record.id ? { ...r, syncError: msg } : r)
      setRecords(updated)
      saveOfflineRecords(updated)
      toast({ title: 'Sync rejected', description: msg, variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncLivenessComplete = async (livenessProof: LivenessProof) => {
    if (!pendingVerify) return
    setSyncing(true)
    const { record, challengeToken } = pendingVerify
    try {
      const res = await attendanceService.syncOfflineAttendance([{
        sessionId: record.sessionId,
        qrToken: record.qrToken,
        timestamp: record.timestamp,
        challengeToken,
        livenessProof,
        latitude: record.latitude,
        longitude: record.longitude,
      }])
      const result = res.results?.[0]
      const updated = records.map(r => {
        if (r.id !== record.id) return r
        return {
          ...r,
          synced: result?.status === 'synced' || result?.status === 'duplicate',
          syncError: result?.status === 'failed' ? result.message : undefined,
        }
      })
      setRecords(updated)
      saveOfflineRecords(updated)
      setPendingVerify(null)
      if (result?.status === 'failed') {
        toast({ title: 'Sync failed', description: result.message, variant: 'destructive' })
      } else {
        toast({ title: 'Synced for teacher review', description: result?.message, variant: 'success' })
      }
    } catch (err) {
      const error = err as ApiError
      toast({ title: 'Sync failed', description: error.response?.data?.message || 'Verification failed', variant: 'destructive' })
      setPendingVerify(null)
    } finally {
      setSyncing(false)
    }
  }

  const deleteRecord = (id: string) => {
    const updated = records.filter(r => r.id !== id)
    setRecords(updated)
    saveOfflineRecords(updated)
  }

  const clearSynced = () => {
    const updated = records.filter(r => !r.synced)
    setRecords(updated)
    saveOfflineRecords(updated)
    toast({ title: 'Cleared synced records' })
  }

  const pendingCount = records.filter(r => !r.synced).length
  const syncedCount  = records.filter(r => r.synced).length

  if (pendingVerify) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
          Complete the live facial liveness check to submit your offline-scanned QR record for teacher approval.
        </div>
        <FacialRecognitionCapture
          mode="verify"
          livenessActions={pendingVerify.livenessActions}
          isLoading={syncing}
          onSuccess={handleSyncLivenessComplete}
          onCancel={() => setPendingVerify(null)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-5">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          {isOnline
            ? <Wifi className="w-5 h-5 text-green-500" />
            : <WifiOff className="w-5 h-5 text-amber-500" />}
          Offline QR Queue
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Scan the projector QR offline; verify live with your face once internet returns.
        </p>
      </div>

      <div className={`rounded-xl border p-3 flex items-center gap-3 ${isOnline ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-amber-500/10 border-amber-500/25'}`}>
        {isOnline
          ? <><Wifi className="w-4 h-4 text-emerald-500 shrink-0" /><p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Online: sync pending QR scans with live verification</p></>
          : <><WifiOff className="w-4 h-4 text-amber-500 shrink-0" /><div><p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Offline mode active</p><p className="text-xs text-muted-foreground">Scan the live classroom QR now; verify & sync when back online.</p></div></>
        }
      </div>

      <div className="flex border rounded-lg overflow-hidden">
        <button
          onClick={() => setTab('capture')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'capture' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          Scan QR
        </button>
        <button
          onClick={() => setTab('queue')}
          className={`flex-1 py-2 text-sm font-medium transition-colors relative ${tab === 'queue' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          Sync Queue
          {pendingCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'capture' && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <QrCode className="w-4 h-4" />
            <span>Scan the classroom QR code directly (static codes are disabled)</span>
          </div>

          {!scanning ? (
            <Button onClick={() => setScanning(true)} className="w-full gap-2" variant="gradient">
              <Camera className="w-4 h-4" />
              Scan Classroom QR Offline
            </Button>
          ) : (
            <div className="space-y-3">
              <div id="offline-qr-viewfinder" className="w-full rounded-xl overflow-hidden bg-black" style={{ minHeight: 260 }} />
              <Button variant="outline" className="w-full" onClick={() => setScanning(false)}>
                Stop Scanner
              </Button>
            </div>
          )}

          <div className="bg-muted/50 border border-border rounded-xl p-3 text-xs text-muted-foreground">
            <strong>Security Policy:</strong> Offline captures record the cryptographic QR token and GPS location, and require live facial liveness + teacher approval when synced online.
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {pendingCount} pending · {syncedCount} synced
            </p>
            {syncedCount > 0 && (
              <Button size="sm" variant="outline" onClick={clearSynced} className="text-xs gap-1">
                <Trash2 className="w-3 h-3" /> Clear synced
              </Button>
            )}
          </div>

          {records.length === 0 ? (
            <div className="text-center py-12 bg-card border rounded-xl text-muted-foreground">
              <CloudUpload className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No offline QR scans yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map(r => (
                <div
                  key={r.id}
                  className={`border rounded-xl p-3 ${
                    r.synced
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                      : r.syncError
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                        : 'bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{r.subjectName}</span>
                        {r.synced
                          ? <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle className="w-3 h-3" /> Synced</span>
                          : r.syncError
                            ? <span className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" /> {r.syncError}</span>
                            : <span className="text-xs text-amber-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>
                        }
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                        Session: {r.sessionId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!r.synced && (
                        <Button size="sm" onClick={() => startSyncRecord(r)} disabled={syncing || !isOnline} className="text-xs h-8">
                          Verify & Sync
                        </Button>
                      )}
                      {!r.synced && (
                        <button onClick={() => deleteRecord(r.id)} className="text-muted-foreground hover:text-red-500 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
