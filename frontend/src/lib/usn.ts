// USN format: 4CB{YY}{BRANCH}{NNN}
// Example: 4CB25CS042, 4CB24AI001

export const BRANCHES = [
  { code: 'CS', label: 'CS — Computer Science' },
  { code: 'AI', label: 'AI — Artificial Intelligence' },
  { code: 'IS', label: 'IS — Information Science' },
  { code: 'CG', label: 'CG — Computer & Communication' },
  { code: 'EC', label: 'EC — Electronics & Communication' },
  { code: 'ME', label: 'ME — Mechanical Engineering' },
  { code: 'CV', label: 'CV — Civil Engineering' },
  { code: 'EE', label: 'EE — Electrical Engineering' },
] as const

export type BranchCode = typeof BRANCHES[number]['code']

export const BRANCH_CODES = BRANCHES.map(b => b.code)

/** Full regex: 4CB + 2-digit year + branch + 3-digit roll */
export const USN_REGEX = /^4CB\d{2}(CS|AI|IS|CG|EC|ME|CV|EE)\d{3}$/i

/** Validate a USN string */
export const isValidUSN = (usn: string) => USN_REGEX.test(usn.toUpperCase())

/** Build a USN from parts */
export const buildUSN = (year: string, branch: string, roll: string): string => {
  const yy   = year.padStart(2, '0').slice(-2)
  const br   = branch.toUpperCase()
  const seq  = roll.padStart(3, '0').slice(-3)
  return `4CB${yy}${br}${seq}`
}

/** Parse a USN into its components (returns null if invalid) */
export const parseUSN = (usn: string): { year: string; branch: string; roll: string } | null => {
  const match = usn.toUpperCase().match(/^4CB(\d{2})(CS|AI|IS|CG|EC|ME|CV|EE)(\d{3})$/)
  if (!match) return null
  return { year: match[1], branch: match[2], roll: match[3] }
}

/** Current admission year shorthand (e.g. 2025 → "25") */
export const currentAdmissionYear = (): string =>
  String(new Date().getFullYear()).slice(-2)
