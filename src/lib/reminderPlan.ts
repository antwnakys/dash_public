/** What dash reminds you about, worked out from your data. No phone APIs here, so it can be tested anywhere. */
import type { AgendaItem, Course, Profile } from '@/types'
import { classesOn } from './classes'
import { addDays, fmt, startOfDay } from './date'
import { planTrip } from './commute'
import { cardReminders } from './metroCard'

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

const kindName = { assignment: 'Due', task: 'Due', exam: 'Exam', quiz: 'Quiz' } as const

/** What to remind about in the next two weeks, soonest first. Pure, so it can be tested. */
export function planReminders(input: {
  agenda: AgendaItem[]
  courses: Course[]
  commuteMinutes: number
  trains?: string[]
  /** When the installed app stops opening (iPhone app signed with a free Apple ID). */
  appExpires?: Date
  prefs: NonNullable<Profile['reminders']>
  now: Date
}): Reminder[] {
  const { agenda, courses, commuteMinutes, trains, appExpires, prefs, now } = input
  const out: Omit<Reminder, 'id'>[] = []
  const until = addDays(startOfDay(now), DAYS)

  if (prefs.leave !== false) {
    for (let i = 0; i < DAYS; i++) {
      const day = classesOn(addDays(startOfDay(now), i), agenda, courses)
      // Online lessons: a heads-up to join instead of a reminder to leave.
      for (const c of day.filter((c) => c.online)) {
        const join = new Date(c.start.getTime() - LEAVE_HEADS_UP * 60_000)
        if (join > now)
          out.push({ at: join, title: `${c.title} online in ${LEAVE_HEADS_UP} min`, body: c.link ? 'Open dash to join on Teams' : 'Online lesson' })
      }
      const first = day.find((c) => !c.online)
      if (!first) continue
      const trip = planTrip(first.start, commuteMinutes, trains)
      const at = new Date(trip.leaveAt.getTime() - LEAVE_HEADS_UP * 60_000)
      if (at > now)
        out.push({
          at,
          title: `Leave in ${LEAVE_HEADS_UP} min`,
          body: `${trip.train ? `Take the ${fmt.time.format(trip.train)} suburban · ` : ''}${first.title} at ${fmt.time.format(first.start)}`,
        })
    }
  }

  if (appExpires && prefs.appExpiry !== false) {
    // The evening before at 20:00 (like deadlines), and three hours before as a last call.
    const dayBefore = addDays(startOfDay(appExpires), -1)
    dayBefore.setHours(EVENING_BEFORE, 0, 0, 0)
    const lastCall = new Date(appExpires.getTime() - 3 * 3_600_000)
    const body = 'Reinstall it from your Mac to keep it working. It takes about a minute.'
    if (dayBefore > now && dayBefore < lastCall) out.push({ at: dayBefore, title: 'dash stops opening tomorrow', body })
    if (lastCall > now) out.push({ at: lastCall, title: `dash stops opening at ${fmt.time.format(appExpires)}`, body })
  }

  if (prefs.metroCard !== false) {
    // Monthly, so these are scheduled beyond the two-week window: the next two, in case dash isn't opened for a while.
    for (const at of cardReminders(now))
      out.push({ at, title: 'Your metro card expires tomorrow', body: 'Renew it today so you can travel tomorrow.' })
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
          title: item.kind === 'assignment' || item.kind === 'task' ? `Due tomorrow: ${item.title}` : `${label} tomorrow: ${item.title}`,
          body: `${item.allDay ? 'All day' : fmt.time.format(item.date)}${where}`,
        })
      const soon = new Date(item.date.getTime() - DUE_SOON_HOURS * 3_600_000)
      if (!item.allDay && soon > now && soon > evening)
        out.push({
          at: soon,
          title: item.kind === 'assignment' || item.kind === 'task' ? `Due in ${DUE_SOON_HOURS} hours: ${item.title}` : `${label} in ${DUE_SOON_HOURS} hours: ${item.title}`,
          body: `${fmt.time.format(item.date)}${where}`,
        })
    }
  }

  return out
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX)
    .map((r, i) => ({ ...r, id: i + 1 }))
}

