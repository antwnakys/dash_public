import { classesOn } from './classes'
import { addDays, startOfDay } from './date'
import type { AgendaItem, Commute, CommuteMode, Course, School } from '@/types'
import { t } from '@/i18n'

/** Minutes at school before class starts. */
const SPARE = 5
/** A departure more than this long before class isn't the plan; the door-to-door estimate is closer. */
const MAX_EARLY = 60

/** "public transport", "car"…, as it reads mid-sentence. */
export const modeWords: Record<CommuteMode, string> = {
  transit: t('mode.transit'),
  car: t('mode.car'),
  walk: t('mode.walk'),
  bike: t('mode.bike'),
}

/** "17:11, 17:32 17.50" → ["17:11", "17:32", "17:50"]. */
export function parseTimes(text: string): string[] {
  const times = [...text.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)]
    .map((m) => [Number(m[1]), Number(m[2])])
    .filter(([h, m]) => h < 24 && m < 60)
    .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  return [...new Set(times)].sort()
}

/**
 * When to leave for a class at `classAt`. With fixed departures (a bus or train you always take), aim for the
 * latest one that still gets you there a few minutes early; otherwise leave `minutes` before class.
 */
export function planTrip(classAt: Date, commute: Commute & { minutes: number }): { leaveAt: Date; departure?: Date } {
  const toStop = Math.min(commute.toStop ?? 0, commute.minutes)
  const ride = commute.minutes - toStop
  const latest = classAt.getTime() - (SPARE + ride) * 60_000
  const departure = (commute.departures ?? [])
    .map((t) => {
      const [h, m] = t.split(':').map(Number)
      return new Date(classAt.getFullYear(), classAt.getMonth(), classAt.getDate(), h, m)
    })
    .filter((d) => d.getTime() <= latest)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  if (departure && latest - departure.getTime() <= MAX_EARLY * 60_000)
    return { leaveAt: new Date(departure.getTime() - toStop * 60_000), departure }
  return { leaveAt: new Date(classAt.getTime() - commute.minutes * 60_000) }
}

export interface Departure {
  title: string
  classAt: Date
  /** Missing until the travel time is set. */
  leaveAt?: Date
  /** The bus or train to catch, when one of the saved departures fits. */
  departure?: Date
  tomorrow: boolean
}

// From this hour the evening before, tomorrow's first class is shown.
const EVENING = 17

/** First class of a day that needs the trip (online lessons are taken from home). */
function firstClass(day: Date, agenda: AgendaItem[], courses: Course[]): { title: string; at: Date } | undefined {
  const first = classesOn(day, agenda, courses).find((c) => !c.online)
  return first && { title: first.title, at: first.start }
}

/**
 * When to leave home for the first class of the day. Once that class has started you're at school,
 * so later classes don't count; in the evening it looks ahead to tomorrow's first class.
 */
export function nextDeparture(agenda: AgendaItem[], courses: Course[], now: Date, commute: Commute | undefined): Departure | undefined {
  const today = firstClass(startOfDay(now), agenda, courses)
  const pick = today && today.at > now ? { ...today, tomorrow: false } : undefined
  const next = pick ?? (now.getHours() >= EVENING ? firstClass(addDays(startOfDay(now), 1), agenda, courses) : undefined)
  if (!next) return undefined
  if (!commute?.minutes) return { title: next.title, classAt: next.at, tomorrow: !pick }
  const { leaveAt, departure } = planTrip(next.at, { ...commute, minutes: commute.minutes })
  return { title: next.title, classAt: next.at, leaveAt, departure, tomorrow: !pick }
}

/** Whether a Leave card makes sense yet: a school or courses with weekly times to know when classes are. */
export const knowsClasses = (school: School | undefined, courses: Course[]) =>
  Boolean(school?.address || school?.name) || courses.some((c) => c.meetings?.length)
