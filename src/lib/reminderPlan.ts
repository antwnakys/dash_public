/** What unidash reminds you about, worked out from your data. No phone APIs here, so it can be tested anywhere. */
import type { AgendaItem, Commute, Course, Profile } from '@/types'
import { classesOn } from './classes'
import { addDays, fmt, startOfDay } from './date'
import { planTrip } from './commute'
import { meetingName } from './meeting'
import { passReminders } from './pass'
import { t } from '@/i18n'

export interface Reminder {
  id: number
  at: Date
  title: string
  body: string
}

const DAYS = 14
const MAX = 60
const LEAVE_HEADS_UP = 10 // minutes before it's time to leave
const DUE_SOON_HOURS = 3
const EVENING_BEFORE = 20 // 20:00 the day before

const kindName = { assignment: t('rp.due'), task: t('rp.due'), exam: t('rp.exam'), quiz: t('rp.quiz') } as const

/** What to remind about in the next two weeks, soonest first. Pure, so it can be tested. */
export function planReminders(input: {
  agenda: AgendaItem[]
  courses: Course[]
  commute?: Commute
  /** Day of the month the travel pass runs out, if there is one. */
  passDay?: number
  prefs: NonNullable<Profile['reminders']>
  now: Date
}): Reminder[] {
  const { agenda, courses, commute, passDay, prefs, now } = input
  const out: Omit<Reminder, 'id'>[] = []
  const until = addDays(startOfDay(now), DAYS)

  if (prefs.leave !== false) {
    for (let i = 0; i < DAYS; i++) {
      const day = classesOn(addDays(startOfDay(now), i), agenda, courses)
      // Online lessons: a heads-up to join instead of a reminder to leave.
      for (const c of day.filter((c) => c.online)) {
        const join = new Date(c.start.getTime() - LEAVE_HEADS_UP * 60_000)
        if (join > now)
          out.push({ at: join, title: t('rp.onlineSoon', { title: c.title, n: LEAVE_HEADS_UP }), body: c.link ? t('rp.openToJoin', { service: meetingName(c.link) }) : t('rp.onlineLesson') })
      }
      const first = day.find((c) => !c.online)
      if (!first || !commute?.minutes) continue
      const trip = planTrip(first.start, { ...commute, minutes: commute.minutes })
      const at = new Date(trip.leaveAt.getTime() - LEAVE_HEADS_UP * 60_000)
      if (at > now)
        out.push({
          at,
          title: t('rp.leaveSoon', { n: LEAVE_HEADS_UP }),
          body: `${trip.departure ? t('rp.take', { time: fmt.time.format(trip.departure) }) : ''}${t('rp.classAt', { title: first.title, time: fmt.time.format(first.start) })}`,
        })
    }
  }

  if (passDay && prefs.pass !== false) {
    // Monthly, so these are scheduled beyond the two-week window: the next two, in case unidash isn't opened for a while.
    for (const at of passReminders(passDay, now))
      out.push({ at, title: t('pass.tomorrow'), body: t('pass.tomorrowDetail') })
  }

  if (prefs.deadlines !== false) {
    for (const item of agenda) {
      if (item.kind !== 'assignment' && item.kind !== 'task' && item.kind !== 'exam' && item.kind !== 'quiz') continue
      if (item.date <= now || item.date > until) continue
      const label = kindName[item.kind]
      const where = item.context ? ` · ${item.context}` : ''
      const evening = addDays(startOfDay(item.date), -1)
      evening.setHours(EVENING_BEFORE, 0, 0, 0)
      if (evening > now)
        out.push({
          at: evening,
          title: item.kind === 'assignment' || item.kind === 'task' ? t('rp.dueTomorrow', { title: item.title }) : t('rp.kindTomorrow', { kind: label, title: item.title }),
          body: `${item.allDay ? t('rp.allDay') : fmt.time.format(item.date)}${where}`,
        })
      const soon = new Date(item.date.getTime() - DUE_SOON_HOURS * 3_600_000)
      if (!item.allDay && soon > now && soon > evening)
        out.push({
          at: soon,
          title: item.kind === 'assignment' || item.kind === 'task' ? t('rp.dueIn', { n: DUE_SOON_HOURS, title: item.title }) : t('rp.kindIn', { kind: label, n: DUE_SOON_HOURS, title: item.title }),
          body: `${fmt.time.format(item.date)}${where}`,
        })
    }
  }

  return out
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX)
    .map((r, i) => ({ ...r, id: i + 1 }))
}

