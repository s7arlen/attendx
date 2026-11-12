import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { QrCode, Eye, EyeOff, ArrowRight, ArrowLeft, GraduationCap, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { USN_REGEX } from '@/lib/usn'
import { ApiError } from '@/types'

const schema = z.object({
  name:       z.string().min(2, 'Name must be at least 2 characters'),
  email:      z.string().email('Invalid email'),
  password:   z.string().min(8, 'Password must be at least 8 characters'),
  role:       z.enum(['teacher', 'student']),
  department: z.string().min(2, 'Department required'),
  year:       z.string().optional(),
  section:    z.string().optional(),
  rollNumber: z.string()
    .optional()
    .refine(v => !v || USN_REGEX.test(v.toUpperCase()), {
      message: 'USN must be in format 4CB25CS001',
    }),
  phone:      z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'student' },
  })

  const role = watch('role')

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const payload = {
        ...data,
        year: data.year ? parseInt(data.year) : undefined,
      }
      const result = await authService.register(payload)
      setAuth(result.user, result.accessToken, result.refreshToken)
      toast({ title: 'Account created!', description: 'Welcome to AttendX', variant: 'success' })
      navigate(`/${result.user.role}`)
    } catch (err) {
      const error = err as ApiError;
      toast({
        title: 'Registration failed',
        description: error.response?.data?.message || 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold gradient-text">AttendX</span>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Create your account</h2>
            <p className="text-muted-foreground mt-1 text-sm">Join AttendX and start tracking attendance</p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6" role="radiogroup" aria-label="Account type">
            {(['student', 'teacher'] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setValue('role', r)}
                className={`p-3 rounded-xl border-2 text-sm font-medium capitalize transition-all duration-200 ${
                  role === r
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground'
                }`}
              >
                {r === 'student' ? <GraduationCap className="w-3.5 h-3.5 inline mr-1" /> : <Users className="w-3.5 h-3.5 inline mr-1" />}{r}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name</Label>
                <Input placeholder="John Doe" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Email</Label>
                <Input type="email" placeholder="you@university.edu" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    {...register('password')}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Department</Label>
                <Input placeholder="Computer Science" {...register('department')} />
                {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
              </div>

              {role === 'student' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Year</Label>
                    <Select onValueChange={(v) => setValue('year', v)}>
                      <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((y) => (
                          <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Section</Label>
                    <Input placeholder="A, B, C..." {...register('section')} />
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <Label>USN / Roll Number</Label>
                    <Controller
                      name="rollNumber"
                      control={control}
                      render={({ field }) => {
                        const isValid = !field.value || USN_REGEX.test(field.value.toUpperCase())
                        return (
                          <div className="space-y-1">
                            <Input
                              placeholder="4CB25CS001"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                              maxLength={12}
                              className={`font-mono uppercase tracking-widest ${field.value && !isValid ? 'border-destructive' : ''}`}
                            />
                            <p className={`text-xs ${field.value ? (isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive') : 'text-muted-foreground'}`}>
                              {field.value ? (isValid ? `Valid: ${field.value}` : 'e.g. 4CB25CS001 · year · branch · roll') : 'Format: 4CB25CS001'}
                            </p>
                          </div>
                        )
                      }}
                    />
                    {errors.rollNumber && <p className="text-xs text-destructive">{errors.rollNumber.message}</p>}
                  </div>
                </>
              )}

              <div className="space-y-1.5 col-span-2">
                <Label>Phone (optional)</Label>
                <Input placeholder="+1 234 567 8900" {...register('phone')} />
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" size="lg" loading={loading} variant="gradient">
              Create Account
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link to="/login" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
