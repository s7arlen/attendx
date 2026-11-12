import { User, Mail, Building2, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/authStore'
import { ProfileEditCard, ChangePasswordCard } from '@/components/shared/ProfileEditor'
import AvatarUpload from '@/components/shared/AvatarUpload'

export default function AdminProfilePage() {
  const { user } = useAuthStore()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">My Profile</h2>
        <p className="text-sm text-muted-foreground">Your account details and security settings</p>
      </div>

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
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="error" className="capitalize">{user?.role}</Badge>
                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Full access
                </div>
              </div>
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
    </div>
  )
}
