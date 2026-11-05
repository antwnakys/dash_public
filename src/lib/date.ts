const DAY_MS = 86_400_000

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function dayDiff(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS)
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayDiff(a, b) === 0
}

/** Human countdown: "in 3h", "tomorrow", "in 2 days", "3 days ago". */
export function countdown(target: Date, now: Date = new Date()): string {
  const days = dayDiff(now, target)
  if (days === 0) {
    const mins = Math.round((target.getTime() - now.getTime()) / 60_000)
    if (mins <= 0) return 'today'
    if (mins < 60) return `in ${mins}m`
    return `in ${Math.round(mins / 60)}h`
  }
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days > 1) return days < 14 ? `in ${days} days` : `in ${Math.round(days / 7)} weeks`
  return `${-days} days ago`
}

/** Monday-first week containing `d`. */
export function weekOf(d: Date): Date[] {
  const offset = (d.getDay() + 6) % 7
  const monday = addDays(startOfDay(d), -offset)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Six Monday-first weeks covering the month of `d`. */
export function monthGrid(d: Date): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const start = weekOf(first)[0]
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export const fmt = {
  time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }),
  weekday: new Intl.DateTimeFormat(undefined, { weekday: 'long' }),
  weekdayShort: new Intl.DateTimeFormat(undefined, { weekday: 'short' }),
  longDate: new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
  shortDate: new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
  monthYear: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }),
}

export function greeting(d: Date): string {
  const h = d.getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
