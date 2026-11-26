import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: { value: number; label: string }
  color?: 'blue' | 'purple' | 'green' | 'amber' | 'red' | 'rose'
  className?: string
  index?: number
}

const colorMap = {
  rose: {
    bg: 'from-rose-500/15 via-rose-500/5 to-transparent',
    icon: 'bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/25',
    badge: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  blue: {
    bg: 'from-rose-500/15 via-orange-500/5 to-transparent',
    icon: 'bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/25',
    badge: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  purple: {
    bg: 'from-purple-500/15 via-fuchsia-500/5 to-transparent',
    icon: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/25',
    badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  green: {
    bg: 'from-emerald-500/15 via-teal-500/5 to-transparent',
    icon: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25',
    badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  amber: {
    bg: 'from-amber-500/15 via-orange-500/5 to-transparent',
    icon: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25',
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  red: {
    bg: 'from-red-500/15 via-rose-500/5 to-transparent',
    icon: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/25',
    badge: 'text-red-400 bg-red-500/10 border-red-500/20',
  },
}

export default function StatCard({
  title, value, icon: Icon, trend, color = 'rose', className, index = 0
}: StatCardProps) {
  const colors = colorMap[color] || colorMap.rose

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/60 dark:border-white/[0.08] bg-white/75 dark:bg-[#130C1C]/70 backdrop-blur-xl p-6 shadow-sm shadow-black/[0.03] dark:shadow-black/30 glass-card-hover group',
        className
      )}
    >
      {/* Background ambient gradient */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-80 pointer-events-none transition-opacity duration-300 group-hover:opacity-100', colors.bg)} />

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <motion.p
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.08 + 0.15, type: 'spring', stiffness: 200, damping: 20 }}
              className="text-3xl font-extrabold mt-2 tabular-nums tracking-tight text-foreground"
            >
              {value}
            </motion.p>
          </div>
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105', colors.icon)}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>

        {trend && (
          <div className="mt-4 flex items-center gap-2">
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', colors.badge)}>
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
