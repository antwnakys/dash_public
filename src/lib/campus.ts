import type { CalendarEvent, Course } from '@/types'

/** Where classes happen. Anything held here is treated as a course. */
export const CAMPUS = 'Sorou 74, Marousi'

/** Lower case, accents removed, final sigma folded: "Σωρού 74, Μαρούσι" → "σωρου 74, μαρουσι". */
export const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/ς/g, 'σ').toLowerCase().replace(/\s+/g, ' ').trim()

/** Letters and digits only, so "CS310" matches "CS 310". */
const compact = (s: string) => normalize(s).replace(/[^\p{L}\p{N}]/gu, '')

const STREET = /\b(sorou|sorou str|σωρου)\b/
const NUMBER = /(sorou|σωρου)\.?\s*(str\.?\s*)?74\b|\b74,?\s*(sorou|σωρου)\b/
const AREA = /\b(a?marous|α?μαρουσ)/

/** True for "Sorou 74, Marousi", "Σωρού 74, Μαρούσι 151 25", "Sorou Str. 74, Athens"… */
export function atCampus(location?: string): boolean {
  if (!location) return false
  const l = normalize(location)
  return NUMBER.test(l) || (STREET.test(l) && AREA.test(l))
}

// normalize() strips accents and turns ς into σ, so "Εξετάσεις" reads "εξετασεισ".
const EXAM_WORDS = /\b(exams?|midterms?|finals?)\b|εξετασ(η|εισ)/
// "Warm-up before the exam" is a study session, not the exam.
const AROUND_EXAM = /(πριν|μετα|για) (την |τισ |το )?εξετασ|\b(before|after|for) (the |my )?exams?\b/

/** Whether a calendar title is an exam: accents and capitals don't matter ("ΕΞΕΤΑΣΗ ΣΗΜΑΤΑ" counts). */
export const isExamTitle = (title: string) => {
  const t = normalize(title)
  return EXAM_WORDS.test(t) && !AROUND_EXAM.test(t)
}

/** @deprecated use isExamTitle; kept so `.test(title)` callers keep working. */
export const EXAM = { test: isExamTitle }

/** A class at campus: on campus, timed, and not an exam (exams keep their own highlight). */
export const isClass = (e: CalendarEvent) => e.kind === 'event' && !e.allDay && atCampus(e.location) && !EXAM.test(e.title)

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
