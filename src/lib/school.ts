import type { CalendarEvent, Course, School } from '@/types'
import { byRole } from './role'

/** Lower case, accents removed, final sigma folded: "Πατησίων 76, Αθήνα" → "πατησιων 76, αθηνα". */
export const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/ς/g, 'σ').toLowerCase().replace(/\s+/g, ' ').trim()

/** Letters and digits only, so "CS310" matches "CS 310". */
const compact = (s: string) => normalize(s).replace(/[^\p{L}\p{N}]/gu, '')

// Greek → Latin, so "Πατησίων 76" and "Patision 76" read the same. Two-letter sounds first.
const PAIRS: Array<[RegExp, string]> = [
  [/ου/g, 'ou'],
  [/αι/g, 'e'],
  [/ει|οι|υι/g, 'i'],
  [/αυ/g, 'av'],
  [/ευ/g, 'ev'],
  [/μπ/g, 'b'],
  [/ντ/g, 'd'],
  [/γκ|γγ/g, 'g'],
]
const LETTERS: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x',
  ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
}

/** One spelling for comparing places: no accents, Greek written in Latin letters, punctuation as spaces. */
export function placeKey(s: string): string {
  let t = normalize(s)
  for (const [re, to] of PAIRS) t = t.replace(re, to)
  t = t.replace(/[α-ω]/g, (c) => LETTERS[c] ?? c)
  // Latin spellings of the same sounds: "ou"/"u", "y"/"i", "ch"/"h".
  return t
    .replace(/ou/g, 'u')
    .replace(/y/g, 'i')
    .replace(/ch/g, 'h')
    .replace(/[^a-z0-9À-￿]+/g, ' ')
    .trim()
}

// Words that say "street" rather than which street.
const FILLER = new Set(['str', 'street', 'st', 'odos', 'odu', 'leof', 'leoforos', 'leoforu', 'av', 'ave', 'avenue', 'rd', 'road', 'pl', 'plateia', 'square', 'the', 'and', 'kai', 'tis', 'tu', 'ton', 'ke'])

/** "Patision 76, Athens" → street words ["patision"], number "76", area words ["athens"]. */
function parseAddress(address: string) {
  const [first = '', ...rest] = address.split(',')
  const words = placeKey(first).split(' ').filter(Boolean)
  const number = words.find((w) => /^\d+[a-z]?$/.test(w))
  const street = words.filter((w) => w !== number && !/^\d/.test(w) && w.length >= 3 && !FILLER.has(w))
  const area = placeKey(rest.join(' '))
    .split(' ')
    .filter((w) => w.length >= 4 && !/^\d/.test(w) && !FILLER.has(w))
  return { street, number, area }
}

const hasWord = (words: string[], w: string) => words.some((x) => x === w || (w.length >= 5 && x.startsWith(w)))

/**
 * Whether an event's location is the school: the street and number of the saved address appear in it
 * ("Πατησίων 76, Αθήνα 104 34" matches "Patision 76, Athens"), or the street and the area, or the school's name.
 */
export function atSchool(location: string | undefined, school: School | undefined): boolean {
  if (!location || !school) return false
  const loc = placeKey(location)
  const words = loc.split(' ')
  if (school.name) {
    const name = placeKey(school.name)
    if (name.length >= 4 && ` ${loc} `.includes(` ${name} `)) return true
  }
  if (!school.address) return false
  const { street, number, area } = parseAddress(school.address)
  if (!street.length || !street.every((w) => hasWord(words, w))) return false
  if (number) return words.includes(number)
  return area.length > 0 && area.some((w) => hasWord(words, w))
}

// normalize() strips accents and turns ς into σ, so "Εξετάσεις" reads "εξετασεισ".
const EXAM_WORDS = /\b(exams?|midterms?|finals?)\b|εξετασ(η|εισ)/
// "Warm-up before the exam" is a study session, not the exam.
const AROUND_EXAM = /(πριν|μετα|για) (την |τισ |το )?εξετασ|\b(before|after|for) (the |my )?exams?\b/

/** Whether a calendar title is an exam: accents and capitals don't matter ("ΕΞΕΤΑΣΗ ΦΥΣΙΚΗΣ", "Physics final"). */
export const isExamTitle = (title: string) => {
  const t = normalize(title)
  return EXAM_WORDS.test(t) && !AROUND_EXAM.test(t)
}

/** A class at school: at the saved address, timed, and not an exam (exams keep their own highlight). */
export const isClass = (e: CalendarEvent, school: School | undefined) =>
  e.kind === 'event' && !e.allDay && atSchool(e.location, school) && !isExamTitle(e.title)

/** "University of Piraeus", else the street of the address ("Karaoli & Dimitriou 80"), else "school". */
export const schoolLabel = (school: School | undefined) => school?.name?.trim() || school?.address?.split(',')[0].trim() || byRole('school.fallback', 'school.fallbackWork')

/** The course an event title refers to: same name, or the course code / name appears in the title. */
export function matchCourse(title: string, courses: Course[]): Course | undefined {
  const t = normalize(title)
  const tight = compact(title)
  return (
    courses.find((c) => c.name && normalize(c.name) === t) ??
    courses.find((c) => (compact(c.code).length > 1 && tight.includes(compact(c.code))) || (c.name.length > 3 && t.includes(normalize(c.name)))) ??
    courses.find((c) => c.name.length > 3 && t.length > 3 && normalize(c.name).includes(t))
  )
}
