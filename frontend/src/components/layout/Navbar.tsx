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
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} aria-label="Toggle menu"
          className="p-2 rounded-xl hover:bg-accent transition-colors md:hidden">
          <Menu className="w-5 h-5" />
        </button>
        {title && (
          <motion.h1 key={title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }} className="text-base md:text-lg font-semibold truncate">
            {title}
          </motion.h1>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Theme */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" className="rounded-xl w-9 h-9">
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
        </Button>

        {/* Notifications */}
        <div className="relative" ref={panelRef}>
          <Button variant="ghost" size="icon" aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
            className="rounded-xl w-9 h-9 relative" onClick={handleOpenNotif}>
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] bg-red-500 rounded-full
                ring-2 ring-card flex items-center justify-center text-[9px] text-white font-bold leading-none px-0.5">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>

          {/* Panel */}
          {notifOpen && (
            <div className="absolute right-0 top-11 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold">Notifications</p>
                {unread > 0 && (
                  <button onClick={() => markReadMutation.mutate()}
                    className="text-xs text-primary hover:underline flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
                ) : (
                  notifications.map((n: AppNotification) => (
                    <div key={n._id}
                      className={cn('flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border last:border-0',
                        !n.read && 'bg-primary/5')}>
                      <div className="mt-0.5 flex-shrink-0">{notifIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', !n.read && 'font-semibold')}>{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" aria-hidden="true" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-2.5 pl-2 ml-1 border-l border-border">
          <img src={user?.avatar || generateAvatarUrl(user?.name || 'User')} alt={user?.name}
            className="w-8 h-8 rounded-full ring-2 ring-primary/20 object-cover flex-shrink-0" />
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-medium truncate max-w-[120px]">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
