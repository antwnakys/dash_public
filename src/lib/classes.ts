import { normalize } from './campus'
import { isSameDay } from './date'
import type { AgendaItem, Course } from '@/types'

export interface ClassSlot {
  title: string
  start: Date
  end?: Date
  courseId?: string
  /** Code of the course it belongs to, when known. */
  code?: string
  online?: boolean
  /** Meeting link for online lessons. */
  link?: string
}

const at = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** A course's classes on `day` from its weekly times, inside its first/last class dates. */
function fromCourse(course: Course, day: Date): ClassSlot[] {
  const key = ymd(day)
  if ((course.term?.start && key < course.term.start) || (course.term?.end && key > course.term.end)) return []
  return (course.meetings ?? [])
    .filter((m) => m.days.includes(day.getDay()))
    .map((m) => ({ title: course.name, start: at(day, m.start), end: m.end ? at(day, m.end) : undefined, courseId: course.id, code: course.code || undefined }))
}

/**
 * Every class on `day`, soonest first: calendar events at campus plus courses' weekly times.
 * When both describe the same class (same start, same course or title), the calendar one wins.
 */
export function classesOn(day: Date, agenda: AgendaItem[], courses: Course[]): ClassSlot[] {
  const code = new Map(courses.map((c) => [c.id, c.code || undefined]))
  const calendar: ClassSlot[] = agenda
    .filter((i) => i.kind === 'class' && !i.allDay && isSameDay(i.date, day))
    .map((i) => ({
      title: i.title,
      start: i.date,
      end: i.end,
      courseId: i.courseId,
      code: i.courseId ? code.get(i.courseId) : undefined,
      online: i.online,
      link: i.link,
    }))
  const key = (s: ClassSlot) => `${s.start.getTime()}|${s.courseId ?? normalize(s.title)}`
  const seen = new Set(calendar.map(key))
  const weekly = courses.flatMap((c) => fromCourse(c, day)).filter((s) => !seen.has(key(s)))
  return [...calendar, ...weekly].sort((a, b) => a.start.getTime() - b.start.getTime())
}
