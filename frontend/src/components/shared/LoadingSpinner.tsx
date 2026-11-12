import { motion } from 'framer-motion'
import { QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
  message?: string
}

export default function LoadingSpinner({ size = 'md', fullScreen = false, message }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  }

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mb-4 shadow-2xl"
        >
          <QrCode className="w-8 h-8 text-white" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-muted-foreground text-sm"
        >
          {message || 'Loading AttendX...'}
        </motion.p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        className={cn('rounded-full border-2 border-primary/20 border-t-primary', sizeMap[size])}
      />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border bg-card p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="h-3 w-24 bg-muted rounded-full" />
          <div className="h-8 w-16 bg-muted rounded-lg" />
        </div>
        <div className="w-12 h-12 bg-muted rounded-2xl" />
      </div>
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl border bg-card">
          <div className="w-10 h-10 bg-muted rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-muted rounded-full" />
            <div className="h-3 w-1/4 bg-muted rounded-full" />
          </div>
          <div className="h-6 w-16 bg-muted rounded-full" />
        </div>
      ))}
    </div>
  )
}
