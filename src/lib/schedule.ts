import type { CalendarEvent, Course, CourseMeeting } from '@/types'

/** A blank class time to fill in. */
export const newMeeting = (): CourseMeeting => ({ days: [], start: '09:00', end: '10:30' })

/** Monday-first, the way weeks are shown everywhere else in dash. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0]

// 4 Jan 2026 was a Sunday, so day n of that week is weekday n.
const weekdayDate = (day: number) => new Date(2026, 0, 4 + day)
const short = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const long = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const narrow = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export const dayName = {
  short: (d: number) => short.format(weekdayDate(d)),
  long: (d: number) => long.format(weekdayDate(d)),
  narrow: (d: number) => narrow.format(weekdayDate(d)),
}

const pad = (n: number) => String(n).padStart(2, '0')
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const fromMinutes = (m: number) => (m >= 1440 ? '23:59' : `${pad(Math.floor(m / 60))}:${pad(m % 60)}`)

/** "13:00" (or "1:00 PM") in the device's own format, as iOS shows it. */
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  return timeFmt.format(new Date(2026, 0, 4, h, m))
}

/** "3 Nov 2026" in the device's own format. */
export const formatDate = (value: string) => dateFmt.format(new Date(`${value}T00:00`))

/** Keeps the class length when the start time moves. */
export function shiftEnd(meeting: CourseMeeting, start: string): CourseMeeting {
  if (!meeting.end) return { ...meeting, start }
  const length = minutes(meeting.end) - minutes(meeting.start)
  return { ...meeting, start, end: fromMinutes(minutes(start) + (length > 0 ? length : 60)) }
}

const sortDays = (days: number[]) => [...new Set(days)].sort((a, b) => WEEK.indexOf(a) - WEEK.indexOf(b))

/** "Tue & Thu 13:00–14:30 · Fri 10:00". */
export function formatMeetings(meetings: CourseMeeting[] = []): string {
  return meetings
    .filter((m) => m.days.length)
    .map((m) => {
      const days = sortDays(m.days).map(dayName.short)
      const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} & ${days.at(-1)}` : days[0]
      return `${list} ${formatTime(m.start)}${m.end ? `–${formatTime(m.end)}` : ''}`
    })
    .join(' · ')
}

const DAY_WORDS: Array<[RegExp, number]> = [
  [/\bmon/i, 1], [/\btue/i, 2], [/\bwed/i, 3], [/\bthu/i, 4], [/\bfri/i, 5], [/\bsat/i, 6], [/\bsun/i, 0],
  [/δευ/i, 1], [/τρι/i, 2], [/τετ/i, 3], [/πεμ|πέμ/i, 4], [/παρ/i, 5], [/σαβ|σάβ/i, 6], [/κυρ/i, 0],
]

/** Best-effort reading of an old free-text schedule such as "Tue, Thu 13:00" or "Mon 10:00-11:30". */
export function parseSchedule(text: string): CourseMeeting[] {
  const days = DAY_WORDS.filter(([re]) => re.test(text)).map(([, d]) => d)
  const times = [...text.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)].map((m) => `${pad(+m[1])}:${m[2]}`)
  if (!days.length || !times.length) return []
  return [{ days: sortDays(days), start: times[0], end: times[1] }]
}

/** When the course next meets, from its weekly times and term dates. */
export function nextMeeting(course: Course, now: Date): Date | undefined {
  const meetings = course.meetings?.filter((m) => m.days.length) ?? []
  if (!meetings.length) return undefined
  const first = course.term?.start ? new Date(`${course.term.start}T00:00`) : undefined
  const last = course.term?.end ? new Date(`${course.term.end}T23:59`) : undefined
  const from = first && first > now ? first : now
  for (let i = 0; i < 8; i++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    const hits = meetings
      .filter((m) => m.days.includes(day.getDay()))
      .map((m) => {
        const [h, min] = m.start.split(':').map(Number)
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min)
      })
      .filter((d) => d > now)
      .sort((a, b) => a.getTime() - b.getTime())
    if (hits.length) return last && hits[0] > last ? undefined : hits[0]
  }
  return undefined
}

/** Weekly times worked out from calendar occurrences of one class. */
export function meetingsFromEvents(events: CalendarEvent[]): CourseMeeting[] {
  const slots = new Map<string, { start: string; end?: string; days: Set<number> }>()
  for (const e of events) {
    const s = new Date(e.start)
    const start = hhmm(s)
    const end = e.end ? hhmm(new Date(e.end)) : undefined
    const key = `${start}-${end ?? ''}`
    const slot = slots.get(key) ?? slots.set(key, { start, end, days: new Set() }).get(key)!
    slot.days.add(s.getDay())
  }
  return [...slots.values()]
    .map((s) => ({ days: sortDays([...s.days]), start: s.start, ...(s.end ? { end: s.end } : {}) }))
    .sort((a, b) => WEEK.indexOf(a.days[0]) - WEEK.indexOf(b.days[0]) || a.start.localeCompare(b.start))
}
