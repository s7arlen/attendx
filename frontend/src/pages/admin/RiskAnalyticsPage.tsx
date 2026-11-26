import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Brain, AlertTriangle, TrendingUp, Users, Activity, Info, RefreshCw } from 'lucide-react'
import { academicService } from '@/services/academic.service'
import { RiskLevel, User, ApiError } from '@/types'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/useToast'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const RISK_COLORS: Record<string, string> = { HIGH: '#ef4444', MODERATE: '#f59e0b', LOW: '#22c55e', UNASSESSED: '#94a3b8' }

export default function RiskAnalyticsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-risk-analytics'],
    queryFn: academicService.getRiskDashboard,
  })

  const { data: mlInfo } = useQuery({
    queryKey: ['ml-info'],
    queryFn: () => academicService.getMLInfo(),
  })

  const retrainMutation = useMutation({
    mutationFn: academicService.retrainMLModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ml-info'] })
      toast({ title: 'Model retrained', description: 'ML classifier updated from institutional student data.', variant: 'success' })
    },
    onError: (err) => {
      const error = err as ApiError
      toast({ title: 'Retraining failed', description: error.response?.data?.message || 'Unable to retrain model.', variant: 'destructive' })
    },
  })

  if (isLoading) return (
    <div className="p-6 space-y-4">{[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
  )

  const summary = data?.summary
  const pieData = [
    { name: 'High Risk', value: summary?.high || 0, color: RISK_COLORS.HIGH },
    { name: 'Moderate Risk', value: summary?.moderate || 0, color: RISK_COLORS.MODERATE },
    { name: 'Low Risk', value: summary?.low || 0, color: RISK_COLORS.LOW },
    { name: 'Not Assessed', value: summary?.unassessed || 0, color: RISK_COLORS.UNASSESSED },
  ].filter(d => d.value > 0)

  const barData = data?.allStudents
    .filter(s => s.riskLevel !== 'UNASSESSED')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10)
    .map(s => ({
      name: ((s.student as User)?.name || '').split(' ')[0],
      score: s.riskScore,
      level: s.riskLevel,
    })) || []

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-primary" /> Risk Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Institution-wide academic risk distribution and model status</p>
      </div>

      {/* Model Status */}
      <div className="glass-card border rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className={`w-2.5 h-2.5 rounded-full ${(mlInfo as any)?.mlAvailable ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <div>
            <p className="text-sm font-semibold">
              Model Status: {(mlInfo as any)?.mlAvailable ? 'Active' : 'Fallback Mode'}
              {(mlInfo as any)?.modelInfo?.metadata?.data_type ? ` (${(mlInfo as any).modelInfo.metadata.data_type})` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {(mlInfo as any)?.modelInfo?.metadata?.model_name || 'Rule-Based Engine'} ·{' '}
              Accuracy: {(mlInfo as any)?.modelInfo?.metadata?.evaluation?.test_accuracy ? `${((mlInfo as any).modelInfo.metadata.evaluation.test_accuracy * 100).toFixed(1)}%` : 'N/A'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          loading={retrainMutation.isPending}
          onClick={() => retrainMutation.mutate()}
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Retrain on Institutional Data
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: summary?.total || 0, color: 'text-rose-500', bg: 'bg-rose-500/10', icon: Users },
          { label: 'High Risk',      value: summary?.high || 0,  color: 'text-red-500',  bg: 'bg-red-500/10',  icon: AlertTriangle },
          { label: 'Moderate Risk',  value: summary?.moderate || 0, color: 'text-amber-500', bg: 'bg-amber-500/10', icon: TrendingUp },
          { label: 'Low Risk',       value: summary?.low || 0,   color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: Activity },
        ].map(c => (
          <div key={c.label} className="glass-card border rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-card border rounded-xl p-5">
          <p className="font-semibold mb-4">Risk Distribution</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm text-center py-8">No risk data yet</p>}
        </div>

        {/* Bar Chart */}
        <div className="glass-card border rounded-2xl p-5">
          <p className="font-semibold mb-4">Top 10 Risk Scores</p>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={RISK_COLORS[entry.level]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm text-center py-8">No data yet</p>}
        </div>
      </div>

      {/* High Risk Students Table */}
      {(data?.highRiskStudents || []).length > 0 && (
        <div className="glass-card border rounded-2xl overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="font-semibold">High Risk Students</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Student</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Roll No.</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Attendance</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Internal Avg</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Risk Score</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Top Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.highRiskStudents.map((s, i) => {
                  const student = s.student as User
                  const topFactor = s.factors?.[0]
                  return (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-4 py-3"><div className="font-medium">{student?.name}</div><div className="text-xs text-muted-foreground">{student?.email}</div></td>
                      <td className="px-4 py-3 font-mono text-xs">{student?.rollNumber || '—'}</td>
                      <td className="px-4 py-3 text-center"><span className={`font-semibold ${(s.attendancePercentage || 100) < 75 ? 'text-red-600' : 'text-green-600'}`}>{s.attendancePercentage != null ? `${s.attendancePercentage}%` : '—'}</span></td>
                      <td className="px-4 py-3 text-center"><span className={`font-semibold ${(s.internalMarksAverage || 100) < 50 ? 'text-red-600' : 'text-green-600'}`}>{s.internalMarksAverage != null ? `${s.internalMarksAverage}%` : '—'}</span></td>
                      <td className="px-4 py-3 text-center"><span className="font-bold text-red-600">{s.riskScore}</span></td>
                      <td className="px-4 py-3 text-xs">{topFactor ? `${topFactor.factor}: ${topFactor.value}% (${topFactor.impact})` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-muted/40 border border-border rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">Risk assessments are advisory only and should not be used as the sole basis for academic decisions.</p>
      </div>
    </div>
  )
}
