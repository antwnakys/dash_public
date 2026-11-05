import { classesOn } from './classes'
import { addDays, startOfDay } from './date'
import type { AgendaItem, Course } from '@/types'

/**
 * Home (Argyroupoli) to campus (Sorou 74, Marousi): walk 10–12 min, metro Line 2 to Syntagma,
 * Line 3 to Doukissis Plakentias, suburban one stop to Pentelis, walk ~8 min. About 80 minutes,
 * most of the spread being the wait for the suburban train.
 */
export const DEFAULT_COMMUTE = 80
/** Both ends of the trip, for the weather hint. */
export const HOME_PLACE = { name: 'Argyroupoli', latitude: 37.906, longitude: 23.752 }
export const CAMPUS_PLACE = { name: 'Marousi', latitude: 38.045, longitude: 23.809 }

export const COMMUTE_ROUTE = 'Walk to Argyroupoli · metro to Doukissis Plakentias · suburban to Pentelis · walk'

/** The suburban trains the user takes from Doukissis Plakentias to Pentelis (Hellenic Train, Nov 2026). */
export const DEFAULT_TRAINS = ['17:11', '17:32', '17:50']
/** Home to the suburban platform at Doukissis Plakentias: walk 11, red line to Syntagma, change, blue line, walk to the platform. */
export const TO_TRAIN = 60
const TRAIN_RIDE = 1 // Doukissis Plakentias → Pentelis
const FROM_STATION = 8 // Pentelis → Sorou 74 on foot
const SPARE = 5 // at campus before class

/** "17:11, 17:32 17.50" → ["17:11", "17:32", "17:50"]. */
export function parseTrainTimes(text: string): string[] {
  const times = [...text.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)]
    .map((m) => [Number(m[1]), Number(m[2])])
    .filter(([h, m]) => h < 24 && m < 60)
    .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  return [...new Set(times)].sort()
}

/**
 * When to leave for a class at `classAt`: aim for the latest listed suburban train that still gets you there
 * with a few minutes to spare (no waiting around on the platform or at campus). If none of the trains fits,
 * fall back to the door-to-door estimate.
 */
export function planTrip(classAt: Date, commuteMinutes: number, trains: string[] = DEFAULT_TRAINS): { leaveAt: Date; train?: Date } {
  const latestArrival = classAt.getTime() - (SPARE + FROM_STATION + TRAIN_RIDE) * 60_000
  const train = trains
    .map((t) => {
      const [h, m] = t.split(':').map(Number)
      return new Date(classAt.getFullYear(), classAt.getMonth(), classAt.getDate(), h, m)
    })
    .filter((d) => d.getTime() <= latestArrival)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  // A train hours before the class isn't the plan; then the general estimate is closer.
  if (train && classAt.getTime() - train.getTime() <= 60 * 60_000) return { leaveAt: new Date(train.getTime() - TO_TRAIN * 60_000), train }
  return { leaveAt: new Date(classAt.getTime() - commuteMinutes * 60_000) }
}

export interface Departure {
  title: string
  classAt: Date
  leaveAt: Date
  /** The suburban train to catch, when one of the known trains fits. */
  train?: Date
  tomorrow: boolean
}

// From this hour the evening before, tomorrow's first class is shown.
const EVENING = 17

/** First class of a day. */
function firstClass(day: Date, agenda: AgendaItem[], courses: Course[]): { title: string; at: Date } | undefined {
  // Online lessons are taken from home, so only classes on campus need the trip.
  const first = classesOn(day, agenda, courses).find((c) => !c.online)
  return first && { title: first.title, at: first.start }
}

/**
 * When to leave home for the first class of the day. Once that class has started you're on campus,
 * so later classes don't count; in the evening it looks ahead to tomorrow's first class.
 */
export function nextDeparture(agenda: AgendaItem[], courses: Course[], now: Date, minutes: number, trains?: string[]): Departure | undefined {
  const today = firstClass(startOfDay(now), agenda, courses)
  const pick = today && today.at > now ? { ...today, tomorrow: false } : undefined
  const next = pick ?? (now.getHours() >= EVENING ? firstClass(addDays(startOfDay(now), 1), agenda, courses) : undefined)
  if (!next) return undefined
  const { leaveAt, train } = planTrip(next.at, minutes, trains)
  return { title: next.title, classAt: next.at, leaveAt, train, tomorrow: !pick }
}
