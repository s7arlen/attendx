import { useQuery } from '@tanstack/react-query'
import { Brain, BookOpen, TrendingUp, AlertTriangle, CheckCircle, Award } from 'lucide-react'
import { academicService } from '@/services/academic.service'
import { RiskLevel, ContributingFactor } from '@/types'

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  HIGH:       { label: 'High Risk',     color: 'text-red-500',            bg: 'bg-red-500/10',     border: 'border-red-500/25' },
  MODERATE:   { label: 'Moderate Risk', color: 'text-amber-500',          bg: 'bg-amber-500/10',   border: 'border-amber-500/25' },
  LOW:        { label: 'Low Risk',      color: 'text-emerald-500',        bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  UNASSESSED: { label: 'Not Assessed',  color: 'text-muted-foreground',   bg: 'bg-muted/40',       border: 'border-border' },
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  )
}

export default function AcademicProfilePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-academic-profile'],
    queryFn: academicService.getMyAcademicProfile,
  })

  const { data: riskData } = useQuery({
    queryKey: ['my-risk'],
    queryFn: academicService.getMyRisk,
  })

  if (isLoading) return (
    <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
  )

  if (isError) return (
    <div className="p-6 text-center text-muted-foreground">Failed to load academic profile.</div>
  )

  const risk = riskData?.latest
  const riskCfg = RISK_CONFIG[risk?.riskLevel || 'UNASSESSED']

  const internalResults = data?.assessmentsByType?.internal_exam || []
  const quizResults = data?.assessmentsByType?.quiz || []
  const assignmentResults = data?.assessmentsByType?.assignment || []

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-primary" /> Academic Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Academic performance and risk assessment</p>
      </div>

      {/* Risk Assessment Card */}
      <div className={`glass-card rounded-2xl border p-5 ${riskCfg.bg} ${riskCfg.border}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Academic Risk Assessment</p>
            <p className={`text-2xl font-bold ${riskCfg.color}`}>{riskCfg.label}</p>
            {risk && <p className="text-xs text-muted-foreground mt-1">Last updated: {new Date(risk.createdAt).toLocaleDateString()}</p>}
          </div>
          {risk && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Risk Score</p>
              <p className={`text-3xl font-bold ${riskCfg.color}`}>{risk.riskScore}<span className="text-base font-normal">/100</span></p>
            </div>
          )}
        </div>

        {/* Contributing Factors */}
        {risk && risk.contributingFactors.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold">Contributing Factors</p>
            {risk.contributingFactors.map((f: ContributingFactor, i: number) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm">{f.factor}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{f.value}{typeof f.value === 'number' ? '%' : ''}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.impact === 'HIGH' ? 'bg-red-100 text-red-700' : f.impact === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{f.impact} impact</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {risk && risk.dataWarnings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {risk.dataWarnings.map((w, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-white/60 rounded-full text-muted-foreground">⚠ {w}</span>
            ))}
          </div>
        )}

        {!risk && (
          <p className="mt-3 text-sm text-muted-foreground">No risk assessment yet. Data will be available once marks and sessions are recorded.</p>
        )}
      </div>

      {/* Recommendations */}
      {risk && risk.recommendations.length > 0 && (
        <div className="bg-card border rounded-xl p-5">
          <p className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Personalized Recommendations</p>
          <ul className="space-y-2">
            {risk.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Attendance per Subject */}
      <div className="bg-card border rounded-xl p-5">
        <p className="font-semibold mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-primary" /> Attendance by Subject</p>
        {data?.attendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance data yet.</p>
        ) : (
          <div className="space-y-4">
            {data?.attendance.map(a => (
              <div key={a.subjectId}>
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <span className="text-sm font-medium">{a.subjectName}</span>
                    <span className="text-xs text-muted-foreground ml-2">{a.subjectCode}</span>
                  </div>
                  <span className={`text-sm font-bold ${a.percentage < 75 ? 'text-red-600' : a.percentage < 85 ? 'text-amber-600' : 'text-green-600'}`}>
                    {a.percentage}% <span className="text-xs font-normal text-muted-foreground">({a.present}/{a.total})</span>
                  </span>
                </div>
                <ProgressBar value={a.percentage} color={a.percentage < 75 ? 'bg-red-500' : a.percentage < 85 ? 'bg-amber-500' : 'bg-green-500'} />
                {a.percentage < 75 && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Below 75% — attendance shortage</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Internal Exams */}
      {internalResults.length > 0 && (
        <div className="bg-card border rounded-xl p-5">
          <p className="font-semibold mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Internal Exams</p>
          <div className="space-y-3">
            {internalResults.map((r, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.subjectName} · {r.subjectCode}</p>
                </div>
                {r.isAbsent ? (
                  <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">Absent</span>
                ) : (
                  <div className="text-right">
                    <p className="text-sm font-bold">{r.marksObtained}/{r.maxMarks}</p>
                    <p className={`text-xs ${r.percentage < 40 ? 'text-red-600' : r.percentage < 60 ? 'text-amber-600' : 'text-green-600'}`}>{r.percentage}%</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quizzes */}
      {quizResults.length > 0 && (
        <div className="bg-card border rounded-xl p-5">
          <p className="font-semibold mb-4">Quiz Results</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quizResults.map((r, i) => (
              <div key={i} className="border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.subjectCode}</p>
                {r.isAbsent ? (
                  <p className="text-sm text-slate-500 mt-1">Absent</p>
                ) : (
                  <p className={`text-lg font-bold mt-1 ${r.percentage < 40 ? 'text-red-600' : r.percentage < 60 ? 'text-amber-600' : 'text-green-600'}`}>{r.percentage}%</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {internalResults.length === 0 && quizResults.length === 0 && (
        <div className="text-center py-8 text-muted-foreground bg-card border rounded-xl">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No assessment results yet. Check back after your faculty publishes marks.</p>
        </div>
      )}

    </div>
  )
}
