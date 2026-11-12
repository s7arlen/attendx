import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  QrCode, User2, Phone, Mail, Building2, Calendar,
  Clock, Users, FileText, CheckCircle2, ChevronRight,
  Loader2, AlertCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import api from '@/lib/axios'

// ── Schema ──────────────────────────────────────────────────
const schema = z.object({
  fullName:          z.string().min(2, 'Full name is required'),
  phone:             z.string().min(6, 'Phone number is required'),
  email:             z.string().email('Valid email required — your QR pass will be sent here'),
  category:          z.enum(['guest','vendor','parent','official','delivery','interview','contractor','other']),
  nationalId:        z.string().optional(),
  company:           z.string().optional(),
  address:           z.string().optional(),
  hostId:            z.string().min(1, 'Please select who you are visiting'),
  purpose:           z.string().min(5, 'Please describe your purpose of visit'),
  department:        z.string().min(2, 'Department is required'),
  visitDate:         z.string().min(1, 'Visit date is required'),
  expectedArrival:   z.string().min(1, 'Expected arrival time is required'),
  expectedDeparture: z.string().min(1, 'Expected departure time is required'),
  accompanyingCount: z.string().optional(),
  notes:             z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface Host { _id: string; name: string; email: string; department: string; role: string }

const CATEGORIES = [
  { value: 'guest',       label: 'Guest'              },
  { value: 'parent',      label: 'Parent / Guardian'  },
  { value: 'vendor',      label: 'Vendor / Supplier'  },
  { value: 'official',    label: 'Government Official' },
  { value: 'delivery',    label: 'Delivery'            },
  { value: 'interview',   label: 'Interview Candidate' },
  { value: 'contractor',  label: 'Contractor'          },
  { value: 'other',       label: 'Other'               },
]

export default function VisitorRequestPage() {
  const [hosts, setHosts]       = useState<Host[]>([])
  const [hostsLoading, setHostsLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')
  const [visitId, setVisitId]   = useState('')

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'guest',
      visitDate: new Date().toISOString().split('T')[0],
      accompanyingCount: '0',
    },
  })

  const selectedHostId = watch('hostId')
  const selectedHost   = hosts.find(h => h._id === selectedHostId)

  useEffect(() => {
    api.get('/visitor/public/hosts')
      .then(res => setHosts(res.data.data.hosts))
      .catch(() => {})
      .finally(() => setHostsLoading(false))
  }, [])

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post('/visitor/public/request', {
        ...data,
        accompanyingCount: parseInt(data.accompanyingCount || '0'),
        email: data.email,
        category: data.category,
      })
      setVisitId(res.data.data.visitId)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ─────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(145deg,#0a0720,#100d2e,#160b40)' }}>
        <div className="absolute inset-0 opacity-[0.055] pointer-events-none"
          style={{ backgroundImage:'radial-gradient(rgba(167,139,250,0.65) 1px,transparent 1px)',backgroundSize:'28px 28px' }} />
        <motion.div
          initial={{ opacity:0, scale:0.95, y:20 }}
          animate={{ opacity:1, scale:1,    y:0  }}
          transition={{ duration:0.6, ease:[0.22,1,0.36,1] }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="rounded-3xl p-8 text-center"
            style={{ background:'rgba(255,255,255,0.055)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
            <motion.div
              initial={{ scale:0 }}
              animate={{ scale:1 }}
              transition={{ delay:0.2, type:'spring', stiffness:200 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background:'rgba(52,211,153,0.15)', border:'2px solid rgba(52,211,153,0.4)' }}
            >
              <CheckCircle2 className="w-10 h-10" style={{ color:'#34d399' }} />
            </motion.div>
            <h2 className="text-2xl font-extrabold text-white mb-2">Request Submitted!</h2>
            <p className="text-sm mb-6" style={{ color:'rgba(255,255,255,0.5)' }}>
              Your visit request has been sent to the host for approval.
            </p>
            <div className="rounded-2xl p-4 mb-6 text-left space-y-2"
              style={{ background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background:'#f59e0b' }} />
                <span className="text-xs font-semibold" style={{ color:'#fbbf24' }}>Pending Approval</span>
              </div>
              <p className="text-sm text-white font-medium">What happens next?</p>
              <ul className="text-xs space-y-1.5" style={{ color:'rgba(255,255,255,0.45)' }}>
                <li className="flex items-start gap-2"><ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-violet-400" />The host will review your request</li>
                <li className="flex items-start gap-2"><ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-violet-400" />If approved, your QR pass will be sent to your email</li>
                <li className="flex items-start gap-2"><ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-violet-400" />Show the QR code or pass code at the security gate</li>
              </ul>
            </div>
            <p className="text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>
              Reference ID: <span className="font-mono text-violet-400">{String(visitId).slice(-8).toUpperCase()}</span>
            </p>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{ background:'linear-gradient(145deg,#0a0720 0%,#100d2e 45%,#160b40 75%,#0d0924 100%)' }}>

      {/* Glow blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full" style={{ width:500,height:500,left:'-10%',top:'-15%',background:'radial-gradient(circle,rgba(109,40,217,0.18) 0%,transparent 68%)',filter:'blur(60px)' }} />
        <div className="absolute rounded-full" style={{ width:400,height:400,right:'-8%',bottom:'-10%',background:'radial-gradient(circle,rgba(79,70,229,0.15) 0%,transparent 68%)',filter:'blur(60px)' }} />
      </div>
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage:'radial-gradient(rgba(167,139,250,0.65) 1px,transparent 1px)',backgroundSize:'28px 28px' }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <motion.div initial={{ opacity:0,y:-16 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.55 }}
          className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background:'linear-gradient(135deg,rgba(109,40,217,0.9),rgba(139,92,246,0.9))',border:'1px solid rgba(255,255,255,0.18)',boxShadow:'0 4px 16px rgba(109,40,217,0.42)' }}>
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">AttendX</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Request a Campus Visit</h1>
          <p className="mt-2 text-sm" style={{ color:'rgba(255,255,255,0.4)' }}>
            Fill in your details below. The faculty member will approve your request and you'll receive a QR pass by email.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div initial={{ opacity:0,y:24,scale:0.97 }} animate={{ opacity:1,y:0,scale:1 }} transition={{ duration:0.65,ease:[0.22,1,0.36,1] }}
          className="rounded-3xl overflow-hidden"
          style={{ background:'rgba(255,255,255,0.055)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 32px 80px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.08)' }}>
          <div className="absolute top-0 left-8 right-8 h-px" style={{ background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)' }} />

          <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-7">

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                  className="flex items-start gap-3 p-3.5 rounded-xl"
                  style={{ background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)' }}>
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Section: Personal Info */}
            <Section icon={User2} title="Your Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name *" error={errors.fullName?.message}>
                  <GlassInput {...register('fullName')} placeholder="John Doe" />
                </Field>
                <Field label="Phone Number *" error={errors.phone?.message}>
                  <GlassInput {...register('phone')} placeholder="+1 234 567 8900" type="tel" />
                </Field>
                <Field label="Email Address *" error={errors.email?.message} hint="Your QR pass will be emailed here">
                  <GlassInput {...register('email')} placeholder="you@example.com" type="email" />
                </Field>
                <Field label="Visitor Category *" error={errors.category?.message}>
                  <Controller name="category" control={control} render={({ field }) => (
                    <SelectGlass value={field.value} onValueChange={field.onChange}
                      options={CATEGORIES} placeholder="Select category" />
                  )} />
                </Field>
                <Field label="National ID / Passport">
                  <GlassInput {...register('nationalId')} placeholder="ID number (optional)" />
                </Field>
                <Field label="Company / Organisation">
                  <GlassInput {...register('company')} placeholder="Your company (optional)" />
                </Field>
              </div>
            </Section>

            {/* Section: Visit Details */}
            <Section icon={Building2} title="Visit Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Who would you like to visit? *" error={errors.hostId?.message}>
                    <Controller name="hostId" control={control} render={({ field }) => (
                      <SelectGlass
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder={hostsLoading ? 'Loading faculty...' : 'Select faculty member...'}
                        options={hosts.map(h => ({ value: h._id, label: `${h.name} — ${h.department} (${h.role})` }))}
                      />
                    )} />
                    {selectedHost && (
                      <p className="text-[11px] mt-1 pl-1" style={{ color:'rgba(167,139,250,0.7)' }}>
                        {selectedHost.department}
                      </p>
                    )}
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Purpose of Visit *" error={errors.purpose?.message}>
                    <GlassInput {...register('purpose')} placeholder="e.g. Meeting about project, Delivery, Job interview..." />
                  </Field>
                </div>
                <Field label="Department *" error={errors.department?.message}>
                  <GlassInput {...register('department')} placeholder="e.g. Computer Science" />
                </Field>
                <Field label="Number of Accompanying Visitors">
                  <GlassInput {...register('accompanyingCount')} type="number" min="0" max="10" placeholder="0" />
                </Field>
              </div>
            </Section>

            {/* Section: Schedule */}
            <Section icon={Calendar} title="Schedule">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <Field label="Visit Date *" error={errors.visitDate?.message}>
                    <GlassInput {...register('visitDate')} type="date" min={new Date().toISOString().split('T')[0]} />
                  </Field>
                </div>
                <Field label="Expected Arrival *" error={errors.expectedArrival?.message}>
                  <GlassInput {...register('expectedArrival')} type="time" />
                </Field>
                <Field label="Expected Departure *" error={errors.expectedDeparture?.message}>
                  <GlassInput {...register('expectedDeparture')} type="time" />
                </Field>
              </div>
            </Section>

            {/* Section: Additional */}
            <Section icon={FileText} title="Additional Notes" optional>
              <GlassInput {...register('notes')} placeholder="Any additional information for the host (optional)" />
            </Section>

            {/* Info box */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl"
              style={{ background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.18)' }}>
              <Mail className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs" style={{ color:'rgba(255,255,255,0.5)' }}>
                Once your request is approved by the faculty member, your QR pass will be sent to your email address. Show it to the security guard at the gate on your visit day.
              </p>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: submitting ? 1 : 1.012 }}
              whileTap={{  scale: submitting ? 1 : 0.985 }}
              className="w-full h-13 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed text-white"
              style={{ height:52,background:'linear-gradient(135deg,#5b21b6 0%,#6d28d9 50%,#7c3aed 100%)',border:'1px solid rgba(167,139,250,0.22)',boxShadow:'0 8px 28px rgba(109,40,217,0.42),inset 0 1px 0 rgba(255,255,255,0.12)' }}
            >
              <motion.span className="absolute inset-0 pointer-events-none"
                style={{ background:'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.12) 50%,transparent 65%)' }}
                animate={{ x:['-100%','200%'] }} transition={{ duration:2,repeat:Infinity,repeatDelay:3,ease:'linear' }} />
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Submitting request…</>
              ) : (
                <>Submit Visit Request<ChevronRight className="w-4 h-4" /></>
              )}
            </motion.button>

          </form>
        </motion.div>

        <p className="text-center text-xs mt-6" style={{ color:'rgba(255,255,255,0.18)' }}>
          © 2025 AttendX · Smart Campus Platform
        </p>
      </div>
    </div>
  )
}

// ── Helper components ────────────────────────────────────────

function Section({ icon: Icon, title, children, optional }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  optional?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 pb-3" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background:'rgba(139,92,246,0.15)' }}>
          <Icon className="w-3.5 h-3.5" style={{ color:'#a78bfa' }} />
        </div>
        <span className="font-semibold text-sm text-white">{title}</span>
        {optional && <span className="text-[10px] ml-1" style={{ color:'rgba(255,255,255,0.3)' }}>(optional)</span>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, error, hint, children }: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.1em]"
        style={{ color:'rgba(255,255,255,0.4)' }}>{label}</label>
      {children}
      {hint && !error && <p className="text-[10px] pl-1" style={{ color:'rgba(255,255,255,0.28)' }}>{hint}</p>}
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity:0,y:-4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
            className="text-xs text-red-400 pl-1">{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const GlassInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <Input
    {...props}
    className="border-0 focus-visible:ring-0 placeholder:text-white/[0.18] text-white/90"
    style={{
      height: 42,
      borderRadius: 10,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.88)',
    }}
  />
)

function SelectGlass({ value, onValueChange, options, placeholder }: {
  value: string
  onValueChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className="border-0 focus:ring-0 text-white/80"
        style={{ height:42,borderRadius:10,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.88)' }}
      >
        <SelectValue placeholder={<span style={{ color:'rgba(255,255,255,0.25)' }}>{placeholder}</span>} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
