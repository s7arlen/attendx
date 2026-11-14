import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  QrCode, User2, Phone, Mail, Building2, Calendar,
  Clock, Users, FileText, CheckCircle2, ChevronRight,
  ChevronDown, Loader2, AlertCircle, Sparkles, ShieldCheck,
  ArrowRight, RefreshCw, Briefcase, Award,
} from 'lucide-react'
import api from '@/lib/axios'
import { useThemeStore } from '@/store/themeStore'

// ── Validation Schema ───────────────────────────────────────
const schema = z.object({
  fullName:          z.string().min(2, 'Please enter your full name'),
  phone:             z.string().min(6, 'Please enter a valid phone number'),
  email:             z.string().email('Valid email required so we can send your QR pass'),
  category:          z.enum(['guest','vendor','parent','official','delivery','interview','contractor','other']),
  hostId:            z.string().min(1, 'Please select who you are visiting'),
  department:        z.string().min(1, 'Department is required'),
  purpose:           z.string().min(3, 'Please state the purpose of your visit'),
  visitDate:         z.string().min(1, 'Visit date is required'),
  expectedArrival:   z.string().min(1, 'Arrival time is required'),
  expectedDeparture: z.string().min(1, 'Departure time is required'),
  // Optional / Collapsible fields
  company:           z.string().optional(),
  nationalId:        z.string().optional(),
  address:           z.string().optional(),
  accompanyingCount: z.string().optional(),
  notes:             z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface Host {
  _id?: string
  id?: string
  name: string
  email: string
  department: string
  role: string
}

const CATEGORIES = [
  { value: 'guest',     label: 'Guest / Visitor', icon: User2 },
  { value: 'parent',    label: 'Parent / Family', icon: Users },
  { value: 'interview', label: 'Interview',       icon: Award },
  { value: 'vendor',    label: 'Vendor / Sales',  icon: Briefcase },
  { value: 'official',  label: 'Official',        icon: ShieldCheck },
  { value: 'other',     label: 'Other',           icon: Sparkles },
]

export default function VisitorRequestPage() {
  const [hosts, setHosts]               = useState<Host[]>([])
  const [hostsLoading, setHostsLoading] = useState(true)
  const [submitted, setSubmitted]       = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState('')
  const [visitId, setVisitId]           = useState('')
  const [showOptional, setShowOptional] = useState(false)

  // Smart defaults: today's date, 10:00 AM to 11:00 AM
  const todayStr = new Date().toISOString().split('T')[0]

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'guest',
      department: '',
      visitDate: todayStr,
      expectedArrival: '10:00',
      expectedDeparture: '11:00',
      accompanyingCount: '0',
    },
  })

  const selectedHostId  = watch('hostId')
  const selectedHost    = hosts.find(h => (h.id || h._id) === selectedHostId)
  const selectedCategory = watch('category')

  // Enforce Light Mode strictly on the public visitor request page
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    return () => {
      const currentTheme = useThemeStore.getState().theme
      if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark')
      }
    }
  }, [])

  // Auto-sync department when a host is picked
  useEffect(() => {
    if (selectedHost) {
      setValue('department', selectedHost.department || 'Administration', { shouldValidate: true })
    }
  }, [selectedHost, setValue])

  // Fetch host directory (public)
  useEffect(() => {
    api.get('/visitor/public/hosts')
      .then(res => setHosts(res.data.data.hosts || []))
      .catch(() => {})
      .finally(() => setHostsLoading(false))
  }, [])

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post('/visitor/public/request', {
        ...data,
        accompanyingCount: parseInt(data.accompanyingCount || '0', 10),
      })
      setVisitId(res.data.data.visitId)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to submit your visit request. Please verify your details.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetForm = () => {
    reset({
      category: 'guest',
      department: '',
      visitDate: todayStr,
      expectedArrival: '10:00',
      expectedDeparture: '11:00',
      accompanyingCount: '0',
      fullName: '',
      phone: '',
      email: '',
      purpose: '',
      company: '',
      nationalId: '',
      notes: '',
    })
    setSubmitted(false)
    setVisitId('')
    setError('')
  }

  // ─────────────────────────────────────────────────────────────
  // 1. SUCCESS CONFIRMATION SCREEN (LIGHT MODE)
  // ─────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 flex items-center justify-center p-4 sm:p-6 text-slate-800">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/60 p-6 sm:p-8 text-center"
        >
          {/* Green Check Icon */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm text-emerald-600">
            <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Visit Request Submitted!
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            We have sent your request to the faculty host for review.
          </p>

          {/* Reference badge */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 mb-6 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference Code</span>
              <span className="text-xs font-mono font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-md">
                {String(visitId).slice(-8).toUpperCase()}
              </span>
            </div>

            <div className="pt-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-semibold text-amber-700">Status: Pending Host Approval</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Once approved by the host, an official <strong>Digital QR Pass</strong> will be sent to your email address. Show that QR pass at the security gate to enter.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={handleResetForm}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Submit Another Request
            </button>
            <p className="text-xs text-slate-400">
              Questions? Please contact the reception desk upon your arrival.
            </p>
          </div>
        </motion.div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // 2. MAIN APPLICATION FORM (LIGHT MODE)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased py-8 px-4 sm:px-6 flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full">

        {/* Clean Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm mb-4">
            <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center text-white">
              <QrCode className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold tracking-tight text-slate-900">AttendX Campus Access</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Apply for a Visitor Pass
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
            Quick 1-minute registration. Your digital pass will be emailed as soon as the host approves.
          </p>
        </div>

        {/* Main White Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100/80 overflow-hidden">
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-8 space-y-6">

            {/* Error Alert */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SECTION 1: Personal Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h2 className="font-semibold text-sm text-slate-900">Your Information</h2>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    {...register('fullName')}
                    type="text"
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all"
                  />
                </div>
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>}
              </div>

              {/* Contact Grid: Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      {...register('phone')}
                      type="tel"
                      placeholder="+1 234 567 8900"
                      className="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all"
                    />
                  </div>
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="sarah@example.com"
                      className="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all"
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                </div>
              </div>

              {/* Visitor Category Quick Pills */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Visiting As <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {CATEGORIES.map(cat => {
                    const isSelected = selectedCategory === cat.value
                    const Icon = cat.icon
                    return (
                      <button
                        type="button"
                        key={cat.value}
                        onClick={() => setValue('category', cat.value as any, { shouldValidate: true })}
                        className={`py-2 px-2 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition-all ${
                          isSelected
                            ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="truncate w-full text-center">{cat.label.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* SECTION 2: Host & Purpose */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h2 className="font-semibold text-sm text-slate-900">Host & Purpose</h2>
              </div>

              {/* Host Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Who Are You Visiting? <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    {...register('hostId')}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">{hostsLoading ? 'Loading faculty hosts...' : 'Select a faculty member or staff...'}</option>
                    {hosts.map(h => {
                      const hostId = h.id || h._id
                      return (
                        <option key={hostId} value={hostId}>
                          {h.name} ({h.department})
                        </option>
                      )
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {errors.hostId && <p className="text-xs text-red-500 mt-1">{errors.hostId.message}</p>}

                {/* Auto-filled Department badge */}
                {selectedHost && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 border border-violet-200/80 rounded-lg text-xs text-violet-700 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-violet-500" />
                    <span>Department: <strong>{selectedHost.department}</strong></span>
                  </div>
                )}
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Purpose of Visit <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('purpose')}
                  type="text"
                  placeholder="e.g. Project consultation, Parent-teacher meeting, Interview"
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all"
                />
                {errors.purpose && <p className="text-xs text-red-500 mt-1">{errors.purpose.message}</p>}
              </div>
            </div>

            {/* SECTION 3: Schedule */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h2 className="font-semibold text-sm text-slate-900">Schedule</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Visit Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('visitDate')}
                    type="date"
                    min={todayStr}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all cursor-pointer"
                  />
                  {errors.visitDate && <p className="text-xs text-red-500 mt-1">{errors.visitDate.message}</p>}
                </div>

                {/* Arrival */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Arrival Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('expectedArrival')}
                    type="time"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all cursor-pointer"
                  />
                  {errors.expectedArrival && <p className="text-xs text-red-500 mt-1">{errors.expectedArrival.message}</p>}
                </div>

                {/* Departure */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departure Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('expectedDeparture')}
                    type="time"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all cursor-pointer"
                  />
                  {errors.expectedDeparture && <p className="text-xs text-red-500 mt-1">{errors.expectedDeparture.message}</p>}
                </div>
              </div>
            </div>

            {/* COLLAPSIBLE SECTION: Optional Details */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOptional(!showOptional)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 py-2 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Additional Details (Company, ID, Guests, Notes)
                  <span className="text-[11px] font-normal text-slate-400">— Optional</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showOptional ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showOptional && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-3.5 pt-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Company / Organization</label>
                        <input
                          {...register('company')}
                          type="text"
                          placeholder="e.g. Acme Inc."
                          className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">National ID / Passport</label>
                        <input
                          {...register('nationalId')}
                          type="text"
                          placeholder="ID number"
                          className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Accompanying Persons</label>
                        <input
                          {...register('accompanyingCount')}
                          type="number"
                          min="0"
                          max="10"
                          placeholder="0"
                          className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Address / City</label>
                        <input
                          {...register('address')}
                          type="text"
                          placeholder="City, State"
                          className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Notes for Host</label>
                      <input
                        {...register('notes')}
                        type="text"
                        placeholder="Any additional remarks"
                        className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Informational Email Note */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-50 border border-violet-100 text-xs text-violet-800">
              <Mail className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
              <span>
                Your approved digital QR Pass will be dispatched directly to your email address. Show it to campus security upon arrival.
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-violet-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Request...</span>
                </>
              ) : (
                <>
                  <span>Submit Visit Request</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6 mb-2">
          © AttendX · Secure Campus Attendance & Visitor Management Platform
        </p>

      </div>
    </div>
  )
}
