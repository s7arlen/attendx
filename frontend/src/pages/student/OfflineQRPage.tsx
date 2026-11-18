import { useState, useEffect } from 'react'
import { WifiOff, Wifi, CloudUpload, CheckCircle, AlertCircle, Trash2, QrCode, KeyRound, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/useToast'
import api from '@/lib/axios'

const STORAGE_KEY = 'attendx_offline_records'

interface OfflineRecord {
  id: string
  sessionId: string
  subjectId: string
  passwordCode: string
  secureToken: string
  subjectName: string
  timestamp: string
  synced: boolean
  syncError?: string
}

function getOfflineRecords(): OfflineRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
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

export default function OfflineQRPage() {
  const isOnline = useOnlineStatus()
  const [records, setRecords] = useState<OfflineRecord[]>(getOfflineRecords)
  const [form, setForm] = useState({ sessionId: '', subjectId: '', passwordCode: '', subjectName: '' })
  const [syncing, setSyncing] = useState(false)
  const [tab, setTab] = useState<'capture' | 'queue'>('capture')

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline) {
      const pending = records.filter(r => !r.synced)
      if (pending.length > 0) {
        toast({ title: `📡 Back online — syncing ${pending.length} record(s)`, variant: 'info' as any })
        syncAll()
      }
    }
  }, [isOnline])

  const saveRecord = () => {
    if (!form.sessionId || !form.passwordCode) {
      toast({ title: 'Session ID and Password Code are required', variant: 'destructive' })
      return
    }

    // Check duplicate
    const existing = records.find(r => r.sessionId === form.sessionId)
    if (existing) {
      toast({ title: 'Already saved for this session', variant: 'destructive' })
      return
    }

    const record: OfflineRecord = {
      id: Date.now().toString(),
      sessionId: form.sessionId.trim(),
      subjectId: form.subjectId.trim(),
      passwordCode: form.passwordCode.trim().toUpperCase(),
      secureToken: '',
      subjectName: form.subjectName.trim() || 'Unknown Subject',
      timestamp: new Date().toISOString(),
      synced: false,
    }

    const updated = [...records, record]
    setRecords(updated)
    saveOfflineRecords(updated)
    setForm({ sessionId: '', subjectId: '', passwordCode: '', subjectName: '' })
    toast({ title: '💾 Saved offline', description: 'Will sync when internet is available', variant: 'success' })
    setTab('queue')
  }

  const syncAll = async () => {
    if (!isOnline) {
      toast({ title: 'No internet connection', description: 'Records saved. Will sync automatically when online.', variant: 'destructive' })
      return
    }

    const pending = records.filter(r => !r.synced)
    if (pending.length === 0) {
      toast({ title: 'Nothing to sync — all records are up to date' })
      return
    }

    setSyncing(true)
    try {
      const payload = pending.map(r => ({
        sessionId: r.sessionId,
        subjectId: r.subjectId,
        passwordCode: r.passwordCode,
        secureToken: r.secureToken,
        timestamp: r.timestamp,
      }))

      const res = await api.post('/attendance/sync-offline', { records: payload })
      const results: { sessionId: string; status: string; message: string }[] = res.data.data.results

      const updated = records.map(r => {
        const result = results.find(x => x.sessionId === r.sessionId)
        if (!result) return r
        return {
          ...r,
          synced: result.status === 'synced' || result.status === 'duplicate',
          syncError: result.status === 'failed' ? result.message : undefined,
        }
      })

      setRecords(updated)
      saveOfflineRecords(updated)

      const synced = results.filter(r => r.status === 'synced').length
      const failed = results.filter(r => r.status === 'failed').length
      const dupes = results.filter(r => r.status === 'duplicate').length

      toast({
        title: `Sync complete`,
        description: `${synced} synced · ${dupes} already marked · ${failed} failed`,
        variant: synced > 0 ? 'success' : 'info' as any,
      })
    } catch (e: any) {
      toast({ title: 'Sync failed', description: e.response?.data?.message || 'Check your connection', variant: 'destructive' })
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
  const syncedCount = records.filter(r => r.synced).length

  return (
    <div className="max-w-md mx-auto p-4 space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          {isOnline
            ? <Wifi className="w-5 h-5 text-green-500" />
            : <WifiOff className="w-5 h-5 text-amber-500" />}
          Offline Attendance
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Save attendance details when offline — syncs automatically when you reconnect
        </p>
      </div>

      {/* Connection status banner */}
      <div className={`rounded-xl border p-3 flex items-center gap-3 ${isOnline ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        {isOnline
          ? <><Wifi className="w-4 h-4 text-green-600 shrink-0" /><p className="text-sm text-green-800 font-medium">Online — attendance saved directly to server</p></>
          : <><WifiOff className="w-4 h-4 text-amber-600 shrink-0" /><div><p className="text-sm text-amber-800 font-medium">Offline mode active</p><p className="text-xs text-amber-700">Records saved to your device. Auto-syncs when internet returns.</p></div></>}
      </div>

      {/* Tabs */}
      <div className="flex border rounded-lg overflow-hidden">
        <button onClick={() => setTab('capture')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'capture' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
          Capture Attendance
        </button>
        <button onClick={() => setTab('queue')}
          className={`flex-1 py-2 text-sm font-medium transition-colors relative ${tab === 'queue' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
          Sync Queue
          {pendingCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* CAPTURE TAB */}
      {tab === 'capture' && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <QrCode className="w-4 h-4" />
            <span>Enter the details from teacher's screen</span>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Subject Name</Label>
              <Input value={form.subjectName} onChange={e => setForm(f => ({ ...f, subjectName: e.target.value }))}
                placeholder="e.g. OOP Java" className="mt-1" />
            </div>
            <div>
              <Label>Session ID <span className="text-red-500">*</span></Label>
              <Input value={form.sessionId} onChange={e => setForm(f => ({ ...f, sessionId: e.target.value }))}
                placeholder="From teacher's screen or session code" className="mt-1 font-mono" />
              <p className="text-xs text-muted-foreground mt-1">The long ID or session code shown by teacher</p>
            </div>
            <div>
              <Label>Password Code <span className="text-red-500">*</span></Label>
              <Input value={form.passwordCode} onChange={e => setForm(f => ({ ...f, passwordCode: e.target.value.toUpperCase() }))}
                placeholder="e.g. OOP-AB3X" className="mt-1 font-mono text-center tracking-widest uppercase" />
            </div>
          </div>

          <Button onClick={saveRecord} className="w-full gap-2">
            {isOnline ? <><CloudUpload className="w-4 h-4" /> Save & Sync Now</> : <><WifiOff className="w-4 h-4" /> Save for Later Sync</>}
          </Button>

          {!isOnline && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              💡 <strong>Tip:</strong> Write down the Session ID and Password Code from the teacher's screen. Enter them here — your attendance will be synced automatically when you get internet access.
            </div>
          )}
        </div>
      )}

      {/* QUEUE TAB */}
      {tab === 'queue' && (
        <div className="space-y-3">
          {/* Sync controls */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {pendingCount} pending · {syncedCount} synced
            </p>
            <div className="flex gap-2">
              {syncedCount > 0 && (
                <Button size="sm" variant="outline" onClick={clearSynced} className="text-xs gap-1">
                  <Trash2 className="w-3 h-3" /> Clear synced
                </Button>
              )}
              {pendingCount > 0 && (
                <Button size="sm" onClick={syncAll} disabled={syncing || !isOnline} className="text-xs gap-1.5">
                  <CloudUpload className="w-3.5 h-3.5" />
                  {syncing ? 'Syncing...' : `Sync ${pendingCount}`}
                </Button>
              )}
            </div>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-12 bg-card border rounded-xl text-muted-foreground">
              <CloudUpload className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No offline records yet</p>
              <p className="text-xs mt-1">Records you capture offline will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map(r => (
                <div key={r.id} className={`border rounded-xl p-3 ${r.synced ? 'bg-green-50 border-green-200' : r.syncError ? 'bg-red-50 border-red-200' : 'bg-card'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{r.subjectName}</span>
                        {r.synced
                          ? <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle className="w-3 h-3" /> Synced</span>
                          : r.syncError
                          ? <span className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" /> {r.syncError}</span>
                          : <span className="text-xs text-amber-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        Code: {r.passwordCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {!r.synced && (
                      <button onClick={() => deleteRecord(r.id)} className="text-muted-foreground hover:text-red-500 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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
