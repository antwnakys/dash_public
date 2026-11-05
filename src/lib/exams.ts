/**
 * Exams and their study plans.
 * Exams are agenda items of kind "exam" (calendar entries titled like an exam, and exams added in dash).
 * Study sessions either come from the calendar (events named after the exam's subject in the weeks before it,
 * like "🚨 ΣΗΜΑΤΑ – Απαγορευτικές" for "🚨🚨 ΕΞΕΤΑΣΗ ΣΗΜΑΤΑ") or are planned by dash on free evenings.
 */
import { isExamTitle, normalize } from './campus'
import { addDays, isSameDay, startOfDay } from './date'
import type { AgendaItem, CalendarEvent, StudySession } from '@/types'

const DAY = 86_400_000
const LOOKBACK_DAYS = 60

export interface Exam {
  id: string
  /** What the exam is about, without emoji or the word "exam": "ΣΗΜΑΤΑ", "Databases". */
  subject: string
  date: Date
  allDay?: boolean
  context?: string
  courseId?: string
  /** Where it was added: the calendar, a course deadline, or + → Exam in dash. */
  source: AgendaItem['source']
  /** A web link from the exam (practice site…). */
  url?: string
}

/** Title without emoji and extra spaces. */
export const cleanTitle = (t: string) =>
  t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim()

const EXAM_WORD = /\b(final exams?|exams?|midterms?|finals?|exam)\b|εξ[εέ]ταση|εξ[εέ]τασεις|εξετάσεις/giu

/** "🚨🚨 ΕΞΕΤΑΣΗ ΣΗΜΑΤΑ" → "ΣΗΜΑΤΑ"; "Databases exam" → "Databases". */
export function examSubject(title: string): string {
  const s = cleanTitle(title).replace(EXAM_WORD, '').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').replace(/\s+/g, ' ').trim()
  return s || cleanTitle(title)
}

/** Exams from today on, soonest first. */
export function upcomingExams(agenda: AgendaItem[], now: Date): Exam[] {
  const today = startOfDay(now)
  return agenda
    .filter((i) => i.kind === 'exam' && i.date >= today)
    .map((i) => ({ id: i.id, subject: examSubject(i.title), date: i.date, allDay: i.allDay, context: i.context, courseId: i.courseId, source: i.source, url: i.url }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** "🚨 ΣΗΜΑΤΑ – Απαγορευτικές" → "Απαγορευτικές" (the part after the dash), else the clean title. */
function topicOf(title: string, subject: string): string {
  const clean = cleanTitle(title)
  const parts = clean.split(/\s[–—-]\s|:\s/)
  if (parts.length > 1) return parts.slice(1).join(' – ').trim()
  const rest = clean.replace(new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim()
  return rest || clean
}

export interface SessionView {
  id: string
  start: Date
  end: Date
  topic: string
  done: boolean
  fromCalendar: boolean
}

/** Study events in the calendar for this exam: same subject in the title, in the weeks before it. */
export function calendarSessions(exam: Exam, events: CalendarEvent[], marks: Map<string, StudySession>): SessionView[] {
  const key = normalize(exam.subject)
  if (key.length < 3) return []
  const from = exam.date.getTime() - LOOKBACK_DAYS * DAY
  return events
    .filter((e) => {
      const t = new Date(e.start).getTime()
      return e.id !== exam.id && t < exam.date.getTime() && t >= from && !isExamTitle(e.title) && normalize(cleanTitle(e.title)).includes(key)
    })
    .map((e) => {
      const start = new Date(e.start)
      return {
        id: e.id,
        start,
        end: e.end ? new Date(e.end) : new Date(start.getTime() + 60 * 60_000),
        topic: topicOf(e.title, exam.subject),
        done: marks.get(e.id)?.done ?? false,
        fromCalendar: true,
      }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Sessions dash planned for this exam. */
export function plannedSessions(exam: Exam, study: StudySession[]): SessionView[] {
  return study
    .filter((s) => s.examId === exam.id && !s.fromCalendar)
    .map((s) => {
      const start = new Date(s.start)
      return { id: s.id, start, end: new Date(start.getTime() + s.minutes * 60_000), topic: s.topic ?? 'Study', done: s.done, fromCalendar: false }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Everything to study for an exam: the calendar's own plan if there is one, else dash's. */
export function sessionsFor(exam: Exam, events: CalendarEvent[], study: StudySession[]): SessionView[] {
  const marks = new Map(study.filter((s) => s.fromCalendar).map((s) => [s.id, s]))
  const fromCalendar = calendarSessions(exam, events, marks)
  return fromCalendar.length ? fromCalendar : plannedSessions(exam, study)
}

const SLOTS = [
  [18, 0],
  [19, 30],
  [16, 30],
  [11, 0],
] as const
const SESSION_MINUTES = 90
const TRAVEL_MINUTES = 100
const MAX_SESSIONS = 6

/**
 * A study plan on free time before the exam: one 90-minute session a day (evenings first, then afternoon or
 * late morning), avoiding anything in the agenda, spread evenly over the days left, at most six.
 * Topics are shared out in order; the last session is a full practice test.
 */
export function planStudy(exam: Exam, agenda: AgendaItem[], now: Date, topics: string[]): StudySession[] {
  const first = startOfDay(now)
  const days: Date[] = []
  for (let d = first; d < startOfDay(exam.date); d = addDays(d, 1)) days.push(d)

  // Classes on campus also block the trip there (about an hour and a half before they start).
  const busy = (day: Date) =>
    agenda
      .filter((i) => !i.allDay && isSameDay(i.date, day))
      .map((i) => {
        const travel = i.kind === 'class' && !i.online ? TRAVEL_MINUTES * 60_000 : 0
        return [i.date.getTime() - travel, (i.end ?? new Date(i.date.getTime() + 60 * 60_000)).getTime()] as const
      })

  const free = days
    .map((day) => {
      const taken = busy(day)
      for (const [h, m] of SLOTS) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
        const end = start.getTime() + SESSION_MINUTES * 60_000
        if (start.getTime() < now.getTime() + 30 * 60_000) continue
        if (taken.every(([a, b]) => end <= a || start.getTime() >= b)) return start
      }
      return undefined
    })
    .filter((d): d is Date => Boolean(d))

  const count = Math.min(MAX_SESSIONS, free.length)
  const picked = Array.from({ length: count }, (_, i) => free[Math.round((i * (free.length - 1)) / Math.max(1, count - 1))])
  const unique = [...new Map(picked.map((d) => [d.getTime(), d])).values()]

  return unique.map((start, i) => {
    const last = i === unique.length - 1 && unique.length > 1
    const topic = last ? 'Full practice test' : topics.length ? topics[i % topics.length] : `Study session ${i + 1}`
    return { id: `${exam.id}@${start.toISOString()}`, examId: exam.id, start: start.toISOString(), minutes: SESSION_MINUTES, topic, done: false }
  })
}
