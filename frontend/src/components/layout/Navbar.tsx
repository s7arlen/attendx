import { useState, useRef, useEffect } from 'react'
import { Bell, Sun, Moon, Menu, CheckCheck, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { generateAvatarUrl, formatDate } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationService, AppNotification } from '@/services/notification.service'
import { cn } from '@/lib/utils'

interface NavbarProps {
  onMenuToggle: () => void
  title?: string
}

const notifIcon = (type: AppNotification['type']) => {
  if (type === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
  if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
  if (type === 'error')   return <XCircle className="w-4 h-4 text-destructive" aria-hidden="true" />
  return <Info className="w-4 h-4 text-primary" aria-hidden="true" />
}

export default function Navbar({ onMenuToggle, title }: NavbarProps) {
  const { theme, toggleTheme }  = useThemeStore()
  const { user }                = useAuthStore()
  const queryClient             = useQueryClient()
  const [notifOpen, setNotifOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getNotifications,
    refetchInterval: 30_000,
  })

  const markReadMutation = useMutation({
    mutationFn: notificationService.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unread = notifData?.unread ?? 0
  const notifications = notifData?.notifications ?? []

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpenNotif = () => {
    setNotifOpen(o => {
      if (!o && unread > 0) markReadMutation.mutate()
      return !o
    })
  }

  return (
    <header className="h-16 bg-white/75 dark:bg-[#130C1C]/75 backdrop-blur-xl border-b border-white/60 dark:border-white/[0.08] flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-30 transition-all shadow-sm shadow-black/[0.02]">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} aria-label="Toggle menu"
          className="p-2 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-foreground transition-colors md:hidden">
          <Menu className="w-5 h-5" />
        </button>
        {title && (
          <motion.h1 key={title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }} className="text-base md:text-lg font-bold tracking-tight text-foreground truncate">
            {title}
          </motion.h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle Button */}
        <Button
          variant="glass"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="rounded-xl w-9 h-9 border border-border/80"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-rose-500 transition-transform hover:-rotate-12" />
          )}
        </Button>

        {/* Notifications Panel */}
        <div className="relative" ref={panelRef}>
          <Button
            variant="glass"
            size="icon"
            aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
            className="rounded-xl w-9 h-9 relative border border-border/80"
            onClick={handleOpenNotif}
          >
            <Bell className="w-4 h-4 text-foreground/80" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] gradient-sunset rounded-full
                ring-2 ring-background flex items-center justify-center text-[9px] text-white font-bold leading-none px-1 shadow-sm shadow-rose-950/40 animate-pulse">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>

          {/* Notification dropdown panel */}
          {notifOpen && (
            <div className="absolute right-0 top-11 w-84 bg-white/90 dark:bg-[#181024]/95 backdrop-blur-2xl border border-white/60 dark:border-white/[0.09] rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/50 z-50 overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
                <p className="text-sm font-bold text-foreground">Notifications</p>
                {unread > 0 && (
                  <button onClick={() => markReadMutation.mutate()}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                    <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
                {notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
                ) : (
                  notifications.map((n: AppNotification) => (
                    <div key={n._id}
                      className={cn('flex items-start gap-3 px-4 py-3 hover:bg-rose-500/[0.06] transition-colors',
                        !n.read && 'bg-rose-500/[0.04]')}>
                      <div className="mt-0.5 flex-shrink-0">{notifIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', !n.read ? 'font-semibold text-foreground' : 'text-foreground/80')}>{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">{formatDate(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full gradient-sunset flex-shrink-0 mt-1.5" aria-hidden="true" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar & Role Badge */}
        <div className="flex items-center gap-2.5 pl-2.5 ml-1 border-l border-border/80">
          <div className="relative">
            <img src={user?.avatar || generateAvatarUrl(user?.name || 'User')} alt={user?.name}
              className="w-8 h-8 rounded-full ring-2 ring-rose-500/30 object-cover flex-shrink-0 shadow-sm" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-semibold truncate max-w-[130px] text-foreground">{user?.name}</p>
            <p className="text-[10px] text-rose-500 dark:text-rose-400 font-medium uppercase tracking-wider">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
