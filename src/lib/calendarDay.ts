/** Everything on one day for the week and day views: classes (calendar + courses' weekly times) and agenda items. */
import { classesOn } from './classes'
import { isSameDay } from './date'
import type { AgendaItem, AgendaKind, Course } from '@/types'
import { t } from '@/i18n'

export interface CalEntry {
  key: string
  title: string
  start: Date
  end?: Date
  allDay?: boolean
  kind: AgendaKind
  context?: string
  /** The agenda item behind it (missing for a class that only exists as a course's weekly time). */
  item?: AgendaItem
  courseId?: string
}

export function dayEntries(day: Date, agenda: AgendaItem[], courses: Course[]): CalEntry[] {
  const classes: CalEntry[] = classesOn(day, agenda, courses).map((c) => {
    const item = agenda.find((i) => i.kind === 'class' && i.date.getTime() === c.start.getTime() && i.title === c.title)
    return {
      key: `class-${c.start.getTime()}-${c.courseId ?? c.title}`,
      title: c.title,
      start: c.start,
      end: c.end,
      kind: 'class',
      context: [c.code, c.online ? t('course.online') : undefined].filter(Boolean).join(' · ') || undefined,
      item,
      courseId: c.courseId,
    }
  })
  const rest: CalEntry[] = agenda
    .filter((i) => i.kind !== 'class' && isSameDay(i.date, day))
    .map((i) => ({ key: `${i.source}-${i.id}`, title: i.title, start: i.date, end: i.end, allDay: i.allDay, kind: i.kind, context: i.context, item: i, courseId: i.courseId }))
  return [...classes, ...rest].sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || a.start.getTime() - b.start.getTime())
}

/** Same time of day on another date. */
export function onDay(time: Date, day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes(), time.getSeconds())
}
