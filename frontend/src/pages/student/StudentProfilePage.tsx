import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Fingerprint, Smartphone, Trash2, ShieldCheck, ShieldAlert, User, Mail, Hash, Building2, ScanFace } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/authStore'
import { webauthnService } from '@/services/webauthn.service'
import { attendanceService } from '@/services/attendance.service'
import { FacialRecognitionCapture } from '@/components/shared/FacialRecognitionCapture'
import { ProfileEditCard, ChangePasswordCard, DeleteAccountCard, EmailVerificationCard } from '@/components/shared/ProfileEditor'
import AvatarUpload from '@/components/shared/AvatarUpload'
import { toast } from '@/hooks/useToast'
import { formatDate } from '@/lib/utils'
import { ApiError } from '@/types'

export default function StudentProfilePage() {
  const { user, updateUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [registering, setRegistering] = useState(false)
  const [enrollingFace, setEnrollingFace] = useState(false)
  const [savingFace, setSavingFace] = useState(false)

  const { data: bioStatus, isLoading: bioLoading } = useQuery({
    queryKey: ['webauthn-status'],
    queryFn: webauthnService.getStatus,
    retry: false,
  })

  const removeMutation = useMutation({
    mutationFn: (credentialId: string) => webauthnService.removeCredential(credentialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webauthn-status'] })
      toast({ title: 'Device removed', variant: 'success' })
    },
    onError: (err) => {
      const error = err as ApiError;
      toast({ title: 'Failed', description: error.response?.data?.message, variant: 'destructive' })
    },
  })

  const handleRegister = async () => {
    setRegistering(true)
    try {
      await webauthnService.registerDevice()
      queryClient.invalidateQueries({ queryKey: ['webauthn-status'] })
      toast({ title: 'Device registered!', description: 'You can now use biometrics to mark attendance.', variant: 'success' })
    } catch (err) {
      const error = err as ApiError;
      const msg = error.response?.data?.message || error.message || ''
      if (!msg.toLowerCase().includes('cancel')) {
        toast({ title: 'Registration failed', description: msg || 'Could not register this device.', variant: 'destructive' })
      }
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">My Profile</h2>
        <p className="text-sm text-muted-foreground">Your account details and security settings</p>
      </div>

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-primary" aria-hidden="true" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex items-center gap-4 pb-5">
            <AvatarUpload />
            <div>
              <p className="text-lg font-semibold">{user?.name}</p>
              <Badge variant="secondary" className="mt-1 capitalize">{user?.role}</Badge>
            </div>
          </div>

          <div className="divide-y divide-border">
            {[
              { icon: Mail,      label: 'Email',       value: user?.email },
              { icon: Hash,      label: 'Roll Number', value: user?.rollNumber || '—' },
              { icon: Building2, label: 'Department',  value: user?.department },
              { icon: User,      label: 'Year & Section', value: user?.year ? `Year ${user.year}${user?.section ? ` · Section ${user.section}` : ''}` : '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-3">
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                <span className="text-sm text-muted-foreground w-28 flex-shrink-0">{label}</span>
                <span className="text-sm font-medium truncate">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ProfileEditCard />
      <EmailVerificationCard />
      <ChangePasswordCard />

      {/* Biometric security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="w-4 h-4 text-primary" aria-hidden="true" />
            Biometric Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status banner */}
          {!bioLoading && (
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${
              bioStatus?.registered
                ? 'bg-emerald-500/5 border-emerald-200 dark:border-emerald-900/50'
                : 'bg-amber-500/5 border-amber-200 dark:border-amber-900/50'
            }`}>
              {bioStatus?.registered
                ? <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                : <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              }
              <div>
                <p className={`text-sm font-medium ${bioStatus?.registered ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {bioStatus?.registered ? 'Biometrics enabled' : 'Biometrics not set up'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {bioStatus?.registered
                    ? `${bioStatus.count} device${bioStatus.count !== 1 ? 's' : ''} registered. You can mark attendance using fingerprint or Face ID.`
                    : 'Register your device to mark attendance with fingerprint or Face ID — no password needed.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Registered devices */}
          {bioStatus?.registered && bioStatus.devices.length > 0 && (
            <div className="divide-y divide-border rounded-xl border overflow-hidden">
              {bioStatus.devices.map((device, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-accent/30 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-4 h-4 text-primary" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{device.deviceType} authenticator</p>
                    <p className="text-xs text-muted-foreground">
                      Registered {formatDate(device.registeredAt)} · ID: {device.credentialId}
                    </p>
                  </div>
                  {!bioStatus.locked && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove this device"
                      className="text-destructive hover:bg-destructive/10 flex-shrink-0"
                      loading={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(device.id)}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Register button */}
          {bioStatus?.locked && bioStatus?.registered ? (
            <p className="text-xs text-muted-foreground text-center p-2.5 rounded-xl bg-muted/40 border">
              Device biometric is locked to this device. Contact an administrator to reset if you change phones.
            </p>
          ) : (
            <Button
              variant={bioStatus?.registered ? 'outline' : 'gradient'}
              className="w-full gap-2"
              loading={registering || bioLoading}
              onClick={handleRegister}
            >
              <Fingerprint className="w-4 h-4" aria-hidden="true" />
              {bioStatus?.registered ? 'Register Another Device' : 'Register This Device'}
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Your biometric data never leaves this device. Only a secure cryptographic key is stored on our server.
          </p>
        </CardContent>
      </Card>

      {/* Facial Recognition Enrollment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanFace className="w-4 h-4 text-primary" aria-hidden="true" />
            Facial Recognition
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-start gap-3 p-3 rounded-xl border ${
            user?.hasFaceDescriptor
              ? 'bg-emerald-500/5 border-emerald-200 dark:border-emerald-900/50'
              : 'bg-amber-500/5 border-amber-200 dark:border-amber-900/50'
          }`}>
            {user?.hasFaceDescriptor
              ? <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              : <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            }
            <div>
              <p className={`text-sm font-medium ${user?.hasFaceDescriptor ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {user?.hasFaceDescriptor ? (user?.faceLocked ? 'Face profile enrolled & locked' : 'Face profile enrolled') : 'Face profile not enrolled'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user?.hasFaceDescriptor
                  ? user?.faceLocked
                    ? 'Locked to prevent proxy re-enrollment. Contact an administrator to reset if needed.'
                    : 'You can use Facial Recognition when scanning class QR codes.'
                  : 'Complete a one-time active liveness check to enroll and lock your face profile.'}
              </p>
            </div>
          </div>

          {user?.hasFaceDescriptor && user?.faceLocked ? (
            <p className="text-xs text-muted-foreground text-center p-2.5 rounded-xl bg-muted/40 border">
              Face enrollment is locked by anti-proxy policy. Ask an administrator to unlock if re-enrollment is required.
            </p>
          ) : !enrollingFace ? (
            <Button
              variant={user?.hasFaceDescriptor ? 'outline' : 'gradient'}
              className="w-full gap-2"
              onClick={() => setEnrollingFace(true)}
            >
              <ScanFace className="w-4 h-4" aria-hidden="true" />
              {user?.hasFaceDescriptor ? 'Re-enroll Face Profile' : 'Enroll Face Profile (Live Check)'}
            </Button>
          ) : (
            <FacialRecognitionCapture
              mode="register"
              isLoading={savingFace}
              onCancel={() => setEnrollingFace(false)}
              onSuccess={async (livenessProof) => {
                setSavingFace(true)
                try {
                  await attendanceService.registerFace(livenessProof)
                  updateUser({ hasFaceDescriptor: true, faceLocked: true })
                  setEnrollingFace(false)
                  toast({ title: 'Face enrolled & locked!', description: 'Live facial verification is now active for attendance.', variant: 'success' })
                } catch (err) {
                  const error = err as ApiError
                  toast({ title: 'Enrollment failed', description: error.response?.data?.message || 'Could not save face enrollment.', variant: 'destructive' })
                } finally {
                  setSavingFace(false)
                }
              }}
            />
          )}
        </CardContent>
      </Card>

      <DeleteAccountCard />
    </div>
  )
}
