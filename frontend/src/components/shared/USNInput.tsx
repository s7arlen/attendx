/**
 * Guided USN (Roll Number) input.
 * Breaks "4CB25CS042" into three controlled parts:
 *   year (2-digit) · branch (select) · roll (3-digit padded)
 * Calls onChange with the full composed USN string.
 */
import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { BRANCHES, buildUSN, parseUSN, currentAdmissionYear } from '@/lib/usn'

interface USNInputProps {
  value?: string
  onChange: (usn: string) => void
  disabled?: boolean
}

export default function USNInput({ value, onChange, disabled }: USNInputProps) {
  const parsed = value ? parseUSN(value) : null

  const [year,   setYear]   = useState(parsed?.year   ?? currentAdmissionYear())
  const [branch, setBranch] = useState(parsed?.branch ?? '')
  const [roll,   setRoll]   = useState(parsed?.roll   ?? '')

  // When all three parts are filled, emit the composed USN
  useEffect(() => {
    if (year && branch && roll.length > 0) {
      onChange(buildUSN(year, branch, roll))
    }
  }, [year, branch, roll, onChange])

  // Sync back if parent resets value
  useEffect(() => {
    if (!value) { setYear(currentAdmissionYear()); setBranch(''); setRoll('') }
    else {
      const p = parseUSN(value)
      if (p) { setYear(p.year); setBranch(p.branch); setRoll(p.roll) }
    }
  }, [value])

  // Preview of composed USN
  const preview = year && branch && roll
    ? buildUSN(year, branch, roll)
    : '4CB__-__'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Fixed prefix */}
        <span className="text-sm font-mono font-semibold text-muted-foreground bg-muted px-2.5 py-2 rounded-lg border border-border flex-shrink-0">
          4CB
        </span>

        {/* Admission year (2-digit) */}
        <Input
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="25"
          value={year}
          disabled={disabled}
          onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
          className="w-14 text-center font-mono"
          aria-label="Admission year (2 digits)"
        />

        {/* Branch */}
        <Select value={branch} onValueChange={setBranch} disabled={disabled}>
          <SelectTrigger className="w-36 font-mono" aria-label="Branch code">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            {BRANCHES.map(b => (
              <SelectItem key={b.code} value={b.code} className="font-mono">
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Roll number (3 digits) */}
        <Input
          type="text"
          inputMode="numeric"
          maxLength={3}
          placeholder="001"
          value={roll}
          disabled={disabled}
          onChange={e => setRoll(e.target.value.replace(/\D/g, '').slice(0, 3))}
          className="w-16 text-center font-mono"
          aria-label="Roll number (3 digits)"
        />
      </div>

      {/* Live preview */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <span>USN:</span>
        <span className={`font-mono font-semibold ${year && branch && roll.length === 3 ? 'text-primary' : 'text-muted-foreground'}`}>
          {preview}
        </span>
      </p>
    </div>
  )
}
