import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: { value: number; label: string }
  color?: 'blue' | 'purple' | 'green' | 'amber' | 'red'
  className?: string
  index?: number
}

const colorMap = {
  blue: {
    bg: 'from-blue-500/10 to-indigo-500/10',
    icon: 'bg-blue-500/10 text-blue-500',
    badge: 'text-blue-500 bg-blue-500/10',
  },
  purple: {
    bg: 'from-purple-500/10 to-violet-500/10',
    icon: 'bg-purple-500/10 text-purple-500',
    badge: 'text-purple-500 bg-purple-500/10',
  },
  green: {
    bg: 'from-emerald-500/10 to-teal-500/10',
    icon: 'bg-emerald-500/10 text-emerald-500',
    badge: 'text-emerald-500 bg-emerald-500/10',
  },
  amber: {
    bg: 'from-amber-500/10 to-yellow-500/10',
    icon: 'bg-amber-500/10 text-amber-500',
    badge: 'text-amber-500 bg-amber-500/10',
  },
  red: {
    bg: 'from-red-500/10 to-rose-500/10',
    icon: 'bg-red-500/10 text-red-500',
    badge: 'text-red-500 bg-red-500/10',
  },
}

export default function StatCard({
  title, value, icon: Icon, trend, color = 'blue', className, index = 0
}: StatCardProps) {
  const colors = colorMap[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card p-6 card-hover',
        className
      )}
    >
      {/* Background gradient */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50', colors.bg)} />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <motion.p
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 + 0.2, type: 'spring' }}
              className="text-3xl font-bold mt-2 tabular-nums"
            >
              {value}
            </motion.p>
          </div>
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0', colors.icon)}>
            <Icon className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>

        {trend && (
          <div className="mt-4 flex items-center gap-2">
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', colors.badge)}>
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
