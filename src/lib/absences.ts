/**
 * Absences per course: the days you missed (`Course.absences`, "YYYY-MM-DD", synced) against an optional limit
 * (`Course.absenceLimit`). "Missed a class" logs the course's latest class that has already started (calendar or
 * weekly times, up to a week back), else today.
 */
import { ymd } from './schedule'
import type { AgendaItem, Course } from '@/types'

export function lastClassDay(course: Course, agenda: AgendaItem[], now: Date): string {
  const fromCalendar = agenda.filter((i) => i.kind === 'class' && i.courseId === course.id && i.date <= now).at(-1)
  const weekly = (() => {
    const meetings = course.meetings?.filter((m) => m.days.length) ?? []
    for (let back = 0; back < 7 && meetings.length; back++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
      const started = meetings.some((m) => {
        if (!m.days.includes(day.getDay())) return false
        const [h, min] = m.start.split(':').map(Number)
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min) <= now
      })
      if (started) return day
    }
    return undefined
  })()
  const latest = [fromCalendar?.date, weekly].filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0]
  return ymd(latest ?? now)
}

export type AbsenceLevel = 'ok' | 'close' | 'over'

/** `close` = one left before the limit; `over` = at or past it. */
export function absenceLevel(course: Course): AbsenceLevel {
  const n = course.absences?.length ?? 0
  const limit = course.absenceLimit
  if (!limit) return 'ok'
  if (n >= limit) return 'over'
  return n >= limit - 1 ? 'close' : 'ok'
}
