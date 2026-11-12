import { useQuery, useQueryClient } from '@tanstack/react-query'
import { User, Mail, Building2, Fingerprint, Smartphone, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { webauthnService } from '@/services/webauthn.service'
import { ProfileEditCard, ChangePasswordCard } from '@/components/shared/ProfileEditor'
import AvatarUpload from '@/components/shared/AvatarUpload'
import { toast } from '@/hooks/useToast'
import { formatDate } from '@/lib/utils'
import { ApiError } from '@/types'
import { useState } from 'react'

export default function TeacherProfilePage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [registering, setRegistering] = useState(false)

  const { data: bioStatus, isLoading: bioLoading } = useQuery({
    queryKey: ['webauthn-status'],
    queryFn: webauthnService.getStatus,
    retry: false,
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => webauthnService.removeCredential(id),
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
      toast({ title: 'Device registered!', variant: 'success' })
    } catch (err) {
      const error = err as ApiError;
      const msg = error.response?.data?.message || error.message || ''
      if (!msg.toLowerCase().includes('cancel'))
        toast({ title: 'Registration failed', description: msg, variant: 'destructive' })
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

      {/* Info summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-primary" aria-hidden="true" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 pb-4">
            <AvatarUpload />
            <div>
              <p className="text-lg font-semibold">{user?.name}</p>
              <Badge variant="blue" className="mt-1 capitalize">{user?.role}</Badge>
            </div>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center gap-3 py-3">
              <Mail className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground w-24">Email</span>
              <span className="text-sm font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3 py-3">
              <Building2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground w-24">Department</span>
              <span className="text-sm font-medium">{user?.department}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProfileEditCard />
      <ChangePasswordCard />

      {/* Biometric */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="w-4 h-4 text-primary" aria-hidden="true" />
            Biometric Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!bioLoading && (
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${bioStatus?.registered
              ? 'bg-emerald-500/5 border-emerald-200 dark:border-emerald-900/50'
              : 'bg-muted/40 border-border'}`}>
              {bioStatus?.registered
                ? <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                : <ShieldAlert className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
              }
              <div>
                <p className="text-sm font-medium">{bioStatus?.registered ? 'Biometrics enabled' : 'Not set up'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {bioStatus?.registered
                    ? `${bioStatus.count} device${bioStatus.count !== 1 ? 's' : ''} registered.`
                    : 'Register your device to use fingerprint or Face ID.'}
                </p>
              </div>
            </div>
          )}

          {bioStatus?.registered && bioStatus.devices.map((d, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-4 h-4 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize">{d.deviceType} authenticator</p>
                <p className="text-xs text-muted-foreground">Registered {formatDate(d.registeredAt)}</p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Remove device"
                className="text-destructive hover:bg-destructive/10"
                loading={removeMutation.isPending}
                onClick={() => removeMutation.mutate(d.credentialId.replace('…', ''))}>
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          ))}

          <Button variant={bioStatus?.registered ? 'outline' : 'gradient'} className="w-full gap-2"
            loading={registering || bioLoading} onClick={handleRegister}>
            <Fingerprint className="w-4 h-4" aria-hidden="true" />
            {bioStatus?.registered ? 'Register Another Device' : 'Register This Device'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
