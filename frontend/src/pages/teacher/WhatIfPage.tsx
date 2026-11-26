import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sliders, Brain, ArrowRight, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { academicService } from '@/services/academic.service'
import { User } from '@/types'
import { Button } from '@/components/ui/button'

const RISK_COLOR: Record<string, string> = {
  HIGH: 'text-red-700 bg-red-50 border-red-200',
  MODERATE: 'text-amber-700 bg-amber-50 border-amber-200',
  LOW: 'text-green-700 bg-green-50 border-green-200',
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium">{label}</label>
        <span className={`text-sm font-bold ${value < 50 ? 'text-red-600' : value < 75 ? 'text-amber-600' : 'text-green-600'}`}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary" />
      <div className="flex justify-between text-xs text-muted-foreground mt-0.5"><span>0%</span><span>50%</span><span>100%</span></div>
    </div>
  )
}

export default function WhatIfPage() {
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [inputs, setInputs] = useState({ attendance: 75, internal: 60, quiz: 60, assignment: 75 })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const { data: studentsData } = useQuery({
    queryKey: ['whatif-students'],
    queryFn: () => adminService.getStudents({ limit: 100 }),
  })
  const students: User[] = studentsData?.students || []

  const simulate = async () => {
    if (!selectedStudentId) return
    setLoading(true)
    try {
      const res = await academicService.whatIfSimulate({
        studentId: selectedStudentId,
        attendancePercentage: inputs.attendance,
        internalMarksAverage: inputs.internal,
        quizAverage: inputs.quiz,
        assignmentCompletion: inputs.assignment,
      })
      setResult(res)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const sim = result?.simulation
  const cur = result?.current

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sliders className="w-6 h-6 text-primary" /> What-If Simulator</h1>
        <p className="text-sm text-muted-foreground mt-1">Adjust hypothetical academic values to see how they affect risk assessment</p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-600 dark:text-amber-400"><strong>Simulation only.</strong> Values are not saved to academic records.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="glass-card border rounded-2xl p-5 space-y-5">
          <div>
            <label className="text-sm font-medium">Select Student</label>
            <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background">
              <option value="">Choose a student...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.rollNumber}</option>)}
            </select>
          </div>

          <Slider label="Attendance %" value={inputs.attendance} onChange={v => setInputs(i => ({ ...i, attendance: v }))} />
          <Slider label="Internal Marks Avg %" value={inputs.internal} onChange={v => setInputs(i => ({ ...i, internal: v }))} />
          <Slider label="Quiz Average %" value={inputs.quiz} onChange={v => setInputs(i => ({ ...i, quiz: v }))} />
          <Slider label="Assignment Completion %" value={inputs.assignment} onChange={v => setInputs(i => ({ ...i, assignment: v }))} />

          <Button onClick={simulate} disabled={!selectedStudentId || loading} className="w-full gap-2">
            <Brain className="w-4 h-4" /> {loading ? 'Simulating...' : 'Run Simulation'}
          </Button>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {!result && (
            <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground h-full flex items-center justify-center">
              <div>
                <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Adjust sliders and click Run Simulation to see the predicted risk assessment</p>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Current vs Simulated */}
              <div className="bg-card border rounded-xl p-5">
                <p className="text-sm font-semibold mb-4">Risk Assessment Comparison</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-2">Current (Actual)</p>
                    {cur ? (
                      <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold border ${RISK_COLOR[cur.riskLevel]}`}>{cur.riskLevel}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not assessed</span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-2">Simulated</p>
                    <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold border ${RISK_COLOR[sim?.riskLevel]}`}>{sim?.riskLevel}</span>
                  </div>
                </div>
                {result.changed && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-primary">
                    <ArrowRight className="w-4 h-4" /> Risk level would change from <strong>{cur?.riskLevel}</strong> to <strong>{sim?.riskLevel}</strong>
                  </div>
                )}
              </div>

              {/* Factors */}
              <div className="bg-card border rounded-xl p-5">
                <p className="text-sm font-semibold mb-3">Simulated Contributing Factors</p>
                {sim?.contributingFactors?.map((f: any, i: number) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="text-sm">{f.factor}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{f.value}%</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${f.impact === 'HIGH' ? 'bg-red-100 text-red-700' : f.impact === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{f.impact}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              {sim?.recommendations?.length > 0 && (
                <div className="bg-card border rounded-xl p-5">
                  <p className="text-sm font-semibold mb-3">Simulated Recommendations</p>
                  {sim.recommendations.map((r: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">Model: {sim?.modelVersion} · {sim?.assessmentType}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
