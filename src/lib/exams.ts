/**
 * Exams and their study plans.
 * Exams are agenda items of kind "exam" (calendar entries titled like an exam, and exams added in unidash).
 * Study sessions either come from the calendar (events named after the exam's subject in the weeks before it,
 * like "Physics – Optics" for "Physics final") or are planned by unidash on free evenings.
 */
import { isExamTitle, normalize } from './school'
import { addDays, isSameDay, startOfDay } from './date'
import type { AgendaItem, CalendarEvent, ExamResult, StudySession } from '@/types'
import { t } from '@/i18n'

const DAY = 86_400_000
const LOOKBACK_DAYS = 60

export interface Exam {
  id: string
  /** What the exam is about, without the word "exam" (emoji kept): "Physics", "ΦΥΣΙΚΗ". */
  subject: string
  date: Date
  allDay?: boolean
  context?: string
  courseId?: string
  /** Where it was added: the calendar, a course deadline, or + → Exam. */
  source: AgendaItem['source']
  /** A web link from the exam (practice site…). */
  url?: string
}

/** Title without emoji and extra spaces. */
export const cleanTitle = (t: string) =>
  t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim()

const EXAM_WORD = /\b(final exams?|exams?|midterms?|finals?|exam)\b|εξ[εέ]ταση|εξ[εέ]τασεις|εξετάσεις/giu

/** "🚨 ΕΞΕΤΑΣΗ ΦΥΣΙΚΗ" → "🚨 ΦΥΣΙΚΗ"; "Databases exam 👾" → "Databases 👾". */
export function examSubject(title: string): string {
  // Emoji stay in what's shown ("👾 Databases"); matching with study events uses `cleanTitle` of it.
  const s = title.replace(EXAM_WORD, '').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').replace(/\s+/g, ' ').trim()
  return cleanTitle(s) ? s : title.replace(/\s+/g, ' ').trim()
}

const asExam = (i: AgendaItem): Exam => ({
  id: i.id,
  subject: examSubject(i.title),
  date: i.date,
  allDay: i.allDay,
  context: i.context,
  courseId: i.courseId,
  source: i.source,
  url: i.url,
})

/** A timed exam counts as over two hours after it starts; an all-day one once its day has passed. */
const EXAM_HOURS = 2
export const isOver = (exam: { date: Date; allDay?: boolean }, now: Date) =>
  exam.allDay ? exam.date < startOfDay(now) : exam.date.getTime() + EXAM_HOURS * 3_600_000 < now.getTime()

/** Exams still to come (or under way), soonest first. Exams that already have a result are done. */
export function upcomingExams(agenda: AgendaItem[], now: Date, results: ExamResult[] = []): Exam[] {
  const done = new Set(results.map((r) => r.id))
  return agenda
    .filter((i) => i.kind === 'exam' && !done.has(i.id))
    .map(asExam)
    .filter((e) => !isOver(e, now))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

const ASK_FOR_DAYS = 30

/** Exams that are over but have no result yet ("How did it go?"), most recent first, up to a month back. */
export function examsAwaitingResult(agenda: AgendaItem[], now: Date, results: ExamResult[] = []): Exam[] {
  const done = new Set(results.map((r) => r.id))
  const from = addDays(startOfDay(now), -ASK_FOR_DAYS)
  return agenda
    .filter((i) => i.kind === 'exam' && !done.has(i.id) && i.date >= from)
    .map(asExam)
    .filter((e) => isOver(e, now))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
}

/** The fields an exam result copies from its exam. */
export const resultTarget = (exam: Exam) =>
  ({
    type: 'examResult',
    id: exam.id,
    subject: exam.subject,
    date: exam.date.toISOString(),
    allDay: exam.allDay,
    courseId: exam.courseId,
    source: exam.source,
  }) as const

/** Results newest first, with counts for the summary. */
export function examHistory(results: ExamResult[]) {
  const list = [...results].sort((a, b) => b.date.localeCompare(a.date))
  return { list, passed: list.filter((r) => r.passed === true).length, failed: list.filter((r) => r.passed === false).length }
}

/** "Physics – Optics" → "Optics" (the part after the dash), else the clean title. */
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
  const key = normalize(cleanTitle(exam.subject))
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
        topic: topicOf(e.title, cleanTitle(exam.subject)),
        done: marks.get(e.id)?.done ?? false,
        fromCalendar: true,
      }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Sessions unidash planned for this exam. */
export function plannedSessions(exam: Exam, study: StudySession[]): SessionView[] {
  return study
    .filter((s) => s.examId === exam.id && !s.fromCalendar)
    .map((s) => {
      const start = new Date(s.start)
      return { id: s.id, start, end: new Date(start.getTime() + s.minutes * 60_000), topic: s.topic ?? t('study.default'), done: s.done, fromCalendar: false }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Everything to study for an exam: the calendar's own plan if there is one, else unidash's. */
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
/** Travel to a class when the trip time isn't set. */
const TRAVEL_MINUTES = 60
const MAX_SESSIONS = 6

/**
 * A study plan on free time before the exam: one 90-minute session a day (evenings first, then afternoon or
 * late morning), avoiding anything in the agenda, spread evenly over the days left, at most six.
 * Topics are shared out in order; the last session is a full practice test.
 */
export function planStudy(exam: Exam, agenda: AgendaItem[], now: Date, topics: string[], travelMinutes = TRAVEL_MINUTES): StudySession[] {
  const first = startOfDay(now)
  const days: Date[] = []
  for (let d = first; d < startOfDay(exam.date); d = addDays(d, 1)) days.push(d)

  // Classes at school also block the trip there.
  const busy = (day: Date) =>
    agenda
      .filter((i) => !i.allDay && isSameDay(i.date, day))
      .map((i) => {
        const travel = i.kind === 'class' && !i.online ? (travelMinutes + 10) * 60_000 : 0
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
    const topic = last ? t('study.practiceTest') : topics.length ? topics[i % topics.length] : t('study.session', { n: i + 1 })
    return { id: `${exam.id}@${start.toISOString()}`, examId: exam.id, start: start.toISOString(), minutes: SESSION_MINUTES, topic, done: false }
  })
}
