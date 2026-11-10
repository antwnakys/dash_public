import { isSameDay, weekOf } from './date'
import type { FocusSession } from '@/types'

export const minutesOn = (sessions: FocusSession[], day: Date) =>
  sessions.filter((s) => isSameDay(new Date(s.start), day)).reduce((n, s) => n + s.minutes, 0)

/** Minutes per day, Monday to Sunday, for the week containing `now`. */
export function weekMinutes(sessions: FocusSession[], now: Date): { days: Date[]; minutes: number[]; total: number } {
  const days = weekOf(now)
  const minutes = days.map((d) => minutesOn(sessions, d))
  return { days, minutes, total: minutes.reduce((a, b) => a + b, 0) }
}
