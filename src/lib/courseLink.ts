/**
 * Courses follow their calendar events' names. A course remembers the event series it came from (`calendarSeries`:
 * a recurring Google event, or an iCal UID) and the calendar name it last took (`calendarTitle`). When the calendar's
 * name for that series changes ("Soft-Dev" → "Soft-Dev 👾"), the course takes the new name, unless the course was
 * renamed in unidash since: then the name typed in unidash wins.
 *
 * A course that isn't linked yet is linked to the series whose classes match it by name (`matchCourse`). On that
 * first link it only takes the calendar's name when the two differ by emoji, case or accents, so a course named
 * differently on purpose keeps its name.
 */
import { isClass, matchCourse, normalize } from './school'
import { cleanTitle } from './exams'
import type { CalendarEvent, Course, Profile } from '@/types'

/** Each device reads the calendar its own way (Google, iCal), so a course can collect a few series ids. */
const MAX_SERIES = 30

const sameName = (a: string, b: string) => normalize(cleanTitle(a)) === normalize(cleanTitle(b))

/** The name most of the series' upcoming classes use, so one renamed or cancelled class doesn't rename the course. */
function seriesTitle(events: CalendarEvent[], now: number): string | undefined {
  const upcoming = events.filter((e) => new Date(e.end ?? e.start).getTime() >= now)
  const pool = (upcoming.length ? upcoming : events).slice().sort((a, b) => a.start.localeCompare(b.start))
  const counts = new Map<string, number>()
  for (const e of pool) counts.set(e.title, (counts.get(e.title) ?? 0) + 1)
  let best: string | undefined
  let most = 0
  // Ties go to the soonest class.
  for (const e of pool) {
    const n = counts.get(e.title)!
    if (n > most) {
      best = e.title
      most = n
    }
  }
  return best
}

/** What to change on each course so it follows its calendar classes (nothing when it already does). */
export function courseCalendarPatches(
  courses: Course[],
  events: CalendarEvent[],
  school: Profile['school'],
  now = Date.now(),
): Array<{ id: string; patch: Partial<Course> }> {
  const bySeries = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    if (!e.series || !isClass(e, school)) continue
    bySeries.set(e.series, [...(bySeries.get(e.series) ?? []), e])
  }
  if (!bySeries.size) return []
  const linkedTo = new Map<string, string>()
  for (const c of courses) for (const s of c.calendarSeries ?? []) linkedTo.set(s, c.id)

  const out: Array<{ id: string; patch: Partial<Course> }> = []
  for (const c of courses) {
    const known = c.calendarSeries ?? []
    const learned = [...bySeries.entries()]
      .filter(([s, list]) => !linkedTo.has(s) && matchCourse(list[0].title, courses)?.id === c.id)
      .map(([s]) => s)
    const series = [...known, ...learned].slice(-MAX_SERIES)
    const mine = series.flatMap((s) => bySeries.get(s) ?? [])
    const title = mine.length ? seriesTitle(mine, now) : undefined

    const patch: Partial<Course> = {}
    if (learned.length) patch.calendarSeries = series
    if (title) {
      const followsCalendar = c.calendarTitle === undefined ? sameName(title, c.name) : c.name === c.calendarTitle
      if (followsCalendar && title !== c.name) patch.name = title
      if (c.calendarTitle === undefined || (followsCalendar && title !== c.calendarTitle)) patch.calendarTitle = title
    }
    if (Object.keys(patch).length) out.push({ id: c.id, patch })
  }
  return out
}

/** The course a calendar class belongs to: the one linked to its series, else the one its name matches. */
export function courseOf(e: CalendarEvent, courses: Course[]): Course | undefined {
  return (e.series ? courses.find((c) => c.calendarSeries?.includes(e.series!)) : undefined) ?? matchCourse(e.title, courses)
}
