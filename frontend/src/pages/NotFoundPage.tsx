import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QrCode, ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'

export default function NotFoundPage() {
  const navigate  = useNavigate()
  const { isAuthenticated, user } = useAuthStore()

  const home = isAuthenticated
    ? user?.role === 'admin' ? '/len-admin' : `/${user?.role}`
    : '/login'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center shadow-lg">
            <QrCode className="w-8 h-8 text-white" aria-hidden="true" />
          </div>
        </div>

        {/* 404 */}
        <div>
          <p className="text-8xl font-bold gradient-text leading-none">404</p>
          <h1 className="text-xl font-semibold mt-3">Page not found</h1>
          <p className="text-muted-foreground text-sm mt-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" className="gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Go Back
          </Button>
          <Button variant="gradient" className="gap-2" onClick={() => navigate(home)}>
            <Home className="w-4 h-4" aria-hidden="true" />
            Go Home
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
