import { useState, useRef, useEffect, useId, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Sun, Moon, Menu, CheckCheck, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { generateAvatarUrl, formatRelative, cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationService, AppNotification } from '@/services/notification.service'

interface NavbarProps {
  onMenuToggle: () => void
  title?: string
}

const notifIcon = (type: AppNotification['type']) => {
  if (type === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
  if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
  if (type === 'error')   return <XCircle className="w-4 h-4 text-destructive" aria-hidden="true" />
  return <Info className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
}

const supportsNativePopover = () =>
  typeof HTMLElement !== 'undefined' &&
  Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover')

const supportsAnchorPositioning = () =>
  typeof CSS !== 'undefined' &&
  CSS.supports('anchor-name: --notif-trigger') &&
  CSS.supports('position-area: block-end')

export default function Navbar({ onMenuToggle, title }: NavbarProps) {
  const { theme, toggleTheme } = useThemeStore()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const popoverId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [notifOpen, setNotifOpen] = useState(false)

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

  // Fallback anchor coordinates for browsers with Popover API but without CSS Anchor Positioning
  const syncFallbackCoordinates = useCallback(() => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel || supportsAnchorPositioning()) return

    const rect = trigger.getBoundingClientRect()
    const rightOffset = Math.max(12, window.innerWidth - rect.right)
    const topOffset = Math.min(rect.bottom + 8, window.innerHeight - 120)
    panel.style.top = `${topOffset}px`
    panel.style.right = `${rightOffset}px`
  }, [])

  // Wire native Popover events (beforetoggle positioning + toggle state sync) and non-popover fallback
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    if (!supportsNativePopover()) {
      const onPointerDown = (e: MouseEvent) => {
        const target = e.target as Node
        if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
        setNotifOpen(false)
      }
      document.addEventListener('mousedown', onPointerDown)
      return () => document.removeEventListener('mousedown', onPointerDown)
    }

    const onBeforeToggle = (e: Event) => {
      const toggleEvent = e as ToggleEvent
      if (toggleEvent.newState === 'open') {
        syncFallbackCoordinates()
      }
    }
    const onToggle = (e: Event) => {
      const toggleEvent = e as ToggleEvent
      setNotifOpen(toggleEvent.newState === 'open')
    }
    const onResize = () => {
      if (panel.matches(':popover-open')) {
        syncFallbackCoordinates()
      }
    }

    panel.addEventListener('beforetoggle', onBeforeToggle)
    panel.addEventListener('toggle', onToggle)
    window.addEventListener('resize', onResize)
    return () => {
      panel.removeEventListener('beforetoggle', onBeforeToggle)
      panel.removeEventListener('toggle', onToggle)
      window.removeEventListener('resize', onResize)
    }
  }, [syncFallbackCoordinates])

  const closeNotifications = () => {
    const panel = panelRef.current as (HTMLDivElement & { hidePopover?: () => void }) | null
    if (panel?.hidePopover) {
      try {
        panel.hidePopover()
      } catch {
        setNotifOpen(false)
      }
    } else {
      setNotifOpen(false)
    }
  }

  const handleNotificationClick = (item: AppNotification) => {
    closeNotifications()
    if (item.link && item.link.startsWith('/')) {
      navigate(item.link)
    }
  }

  const hasPopoverSupport = supportsNativePopover()

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

        {/* Notifications trigger & top-layer popover */}
        <div className="relative">
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
            aria-expanded={notifOpen}
            className="notif-trigger rounded-xl w-9 h-9 relative border border-border/80 bg-background/60 hover:bg-muted/80 focus-visible:ring-foreground/50 focus-visible:ring-offset-0"
            {...(hasPopoverSupport
              ? ({ popovertarget: popoverId } as Record<string, unknown>)
              : {
                  onClick: () => {
                    syncFallbackCoordinates()
                    setNotifOpen((o) => !o)
                  },
                })}
          >
            <Bell className="w-4 h-4 text-foreground/80" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-primary text-primary-foreground rounded-full
                ring-2 ring-background flex items-center justify-center text-[10px] font-semibold leading-none px-1 tabular-nums">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>

          <div
            ref={panelRef}
            id={popoverId}
            {...(hasPopoverSupport ? ({ popover: 'auto' } as Record<string, unknown>) : {})}
            className={cn(
              'notif-popover w-[min(23rem,calc(100vw-1.5rem))] bg-popover text-popover-foreground border border-border/80 rounded-xl shadow-xl overflow-hidden',
              !hasPopoverSupport && (notifOpen ? 'fixed z-50 block' : 'hidden')
            )}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
              <div className="flex items-baseline gap-2 min-w-0">
                <p className="text-sm font-semibold tracking-tight text-foreground">Notifications</p>
                {unread > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">{unread} unread</span>
                )}
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markReadMutation.mutate()}
                  disabled={markReadMutation.isPending}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            <div className="max-h-[min(22rem,calc(100dvh-7rem))] overflow-y-auto divide-y divide-border/50">
              {notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">No notifications yet</p>
              ) : (
                notifications.map((n: AppNotification) => {
                  const rowContent = (
                    <>
                      <div className="mt-0.5 shrink-0">{notifIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={cn(
                            'text-[13px] leading-snug truncate',
                            !n.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/85'
                          )}>
                            {n.title}
                          </p>
                          <span
                            className="text-[11px] text-muted-foreground tabular-nums shrink-0"
                            title={new Date(n.createdAt).toLocaleString()}
                          >
                            {formatRelative(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                      {!n.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" aria-hidden="true" />
                      )}
                    </>
                  )

                  if (n.link && n.link.startsWith('/')) {
                    return (
                      <button
                        key={n._id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          'w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-foreground/50 focus-visible:-outline-offset-2',
                          !n.read && 'bg-muted/30'
                        )}
                      >
                        {rowContent}
                      </button>
                    )
                  }

                  return (
                    <div
                      key={n._id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40',
                        !n.read && 'bg-muted/30'
                      )}
                    >
                      {rowContent}
                    </div>
                  )
                })
              )}
            </div>
          </div>
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
