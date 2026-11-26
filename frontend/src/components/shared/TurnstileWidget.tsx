import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, any>) => string
      remove: (widgetId: string) => void
    }
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onExpire?: () => void
}

/**
 * Renders Cloudflare Turnstile when VITE_TURNSTILE_SITE_KEY is configured.
 * Renders nothing in local/unconfigured environments.
 */
export function TurnstileWidget({ onVerify, onExpire }: TurnstileWidgetProps) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return
      if (widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current) } catch { /* noop */ }
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onVerify(token),
        'expired-callback': () => {
          onVerify('')
          onExpire?.()
        },
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      })
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="true"]')
    if (window.turnstile) {
      renderWidget()
    } else if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.turnstileScript = 'true'
      script.onload = renderWidget
      document.head.appendChild(script)
    } else {
      existing.addEventListener('load', renderWidget)
      return () => existing.removeEventListener('load', renderWidget)
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current) } catch { /* noop */ }
      }
    }
  }, [siteKey, onVerify, onExpire])

  if (!siteKey) return null

  return <div ref={containerRef} className="flex justify-center py-1" />
}
