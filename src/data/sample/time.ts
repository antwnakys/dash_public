import { addDays } from '@/lib/date'

/** ISO timestamp `days` from today at hh:mm, so mock data always looks current. */
export function at(days: number, hour: number, minute = 0): string {
  const d = addDays(new Date(), days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
