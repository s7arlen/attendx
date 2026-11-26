/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm shadow-rose-950/20 hover:bg-rose-600 hover:shadow-md hover:shadow-rose-500/20',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-border/80 bg-background/50 backdrop-blur-md shadow-sm hover:bg-accent/80 hover:text-accent-foreground hover:border-rose-500/30',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:border-rose-500/20',
        ghost: 'hover:bg-accent/70 hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        gradient: 'gradient-sunset text-white shadow-md shadow-rose-950/25 hover:opacity-95 hover:shadow-lg hover:shadow-rose-500/30',
        sunset: 'gradient-sunset text-white shadow-md shadow-rose-950/25 hover:opacity-95 hover:shadow-lg hover:shadow-rose-500/30',
        glass: 'bg-white/10 dark:bg-white/[0.06] backdrop-blur-md border border-white/20 dark:border-white/10 text-foreground hover:bg-white/20 dark:hover:bg-white/[0.12] hover:border-rose-500/30 shadow-sm',
        glow: 'gradient-sunset text-white shadow-[0_0_24px_rgba(244,63,94,0.45)] hover:shadow-[0_0_32px_rgba(244,63,94,0.6)]',
        success: 'bg-emerald-500 text-white shadow hover:bg-emerald-600',
        warning: 'bg-amber-500 text-white shadow hover:bg-amber-600',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-7 text-sm font-semibold',
        xl: 'h-13 rounded-2xl px-9 text-base font-semibold',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
