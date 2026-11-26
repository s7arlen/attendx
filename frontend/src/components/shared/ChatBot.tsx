/**
 * AttendX AI Chatbot — Floating widget
 * Available for students and teachers on all dashboard pages.
 */
import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import api from '@/lib/axios'

interface Message {
  id: string
  role: 'user' | 'bot'
  text: string
  time: string
}

function formatText(text: string) {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

function BotMessage({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {text.split('\n').map((line, i) => (
        <p key={i} className={line === '' ? 'h-2' : ''}>
          {formatText(line)}
        </p>
      ))}
    </div>
  )
}

export default function ChatBot() {
  const { user } = useAuthStore()
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [unread, setUnread]       = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Only for students and teachers
  if (!user || (user.role !== 'student' && user.role !== 'teacher')) return null

  // Load suggestions once
  useEffect(() => {
    api.get('/chatbot/suggestions')
      .then(r => setSuggestions(r.data.data.suggestions))
      .catch(() => {})
  }, [])

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setUnread(0)
    }
  }, [open])

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const welcome = user.role === 'student'
        ? `Hi ${user.name?.split(' ')[0]}. Ask about your attendance, marks, or schedule.`
        : `Hi ${user.name?.split(' ')[0]}. Ask about student risk, subject stats, or interventions.`
      setMessages([{
        id: '0',
        role: 'bot',
        text: welcome,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
    }
  }, [open])

  const send = async (text: string) => {
    const msg = text.trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: msg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await api.post('/chatbot/message', { message: msg })
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: res.data.data.message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, botMsg])
      if (!open) setUnread(u => u + 1)
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: 'Sorry, I ran into an error. Please try again.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm flex flex-col glass-card border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/15 gradient-sunset text-white">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">AttendX Assistant</p>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-75 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 max-h-80">
            {messages.map(m => (
              <div key={m.id} className={cn('flex gap-2.5', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                {m.role === 'bot' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted rounded-tl-sm'
                )}>
                  {m.role === 'bot'
                    ? <BotMessage text={m.text} />
                    : <p className="text-sm">{m.text}</p>
                  }
                  <p className={cn('text-[10px] mt-1 text-right', m.role === 'user' ? 'opacity-60' : 'text-muted-foreground')}>
                    {m.time}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions (shown when no messages beyond welcome) */}
          {messages.length <= 1 && suggestions.length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {suggestions.slice(0, 3).map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="text-xs bg-primary/8 hover:bg-primary/15 text-primary border border-primary/20 rounded-full px-2.5 py-1 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-border flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder="Ask anything…"
              maxLength={500}
              className="flex-1 text-sm bg-muted rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 transition-shadow"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* FAB toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open assistant'}
        className={cn(
          'fixed bottom-4 right-4 sm:right-6 z-50 w-13 h-13 rounded-2xl shadow-xl transition-all duration-200 flex items-center justify-center',
          'gradient-sunset text-white hover:scale-105 active:scale-95',
          open && 'rotate-0'
        )}
        style={{ width: 52, height: 52 }}
      >
        {open
          ? <X className="w-5 h-5" />
          : <MessageCircle className="w-5 h-5" />
        }
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-card">
            {unread}
          </span>
        )}
      </button>
    </>
  )
}
