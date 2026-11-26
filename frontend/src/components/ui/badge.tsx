/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        secondary:   'border-border/60 bg-secondary/80 backdrop-blur-sm text-secondary-foreground hover:bg-secondary',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:     'text-foreground border-border/80 bg-background/40 backdrop-blur-sm',
        sunset:      'border-transparent gradient-sunset text-white shadow-sm shadow-rose-950/20',
        glass:       'border-white/20 dark:border-white/10 bg-white/20 dark:bg-white/[0.06] backdrop-blur-md text-foreground',
        rose:        'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
        success:     'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        warning:     'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        error:       'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
        purple:      'border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400',
        blue:        'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
