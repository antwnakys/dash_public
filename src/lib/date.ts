import { locale, t } from '@/i18n'
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

// Each language's own words for "in 3 days", "tomorrow", "2 hours ago" (built into the browser).
const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
const relativeShort = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })

/** Human countdown: "in 3 hr", "tomorrow", "in 2 days", "3 days ago". */
export function countdown(target: Date, now: Date = new Date()): string {
  const days = dayDiff(now, target)
  if (days === 0) {
    const mins = Math.round((target.getTime() - now.getTime()) / 60_000)
    if (mins <= 0) return t('time.today')
    if (mins < 60) return relativeShort.format(mins, 'minute')
    return relativeShort.format(Math.round(mins / 60), 'hour')
  }
  if (Math.abs(days) < 14) return relative.format(days, 'day')
  return relative.format(Math.round(days / 7), 'week')
}

/** Whole days in words: "today", "tomorrow", "in 3 days". */
export const inDays = (days: number) => relative.format(days, 'day')

/** How long ago something happened: "just now", "5 min ago", "2 hr ago", "yesterday". */
export function since(past: Date, now: Date = new Date()): string {
  const mins = Math.round((now.getTime() - past.getTime()) / 60_000)
  if (mins < 1) return t('time.justNow')
  if (mins < 60) return relativeShort.format(-mins, 'minute')
  if (isSameDay(past, now)) return relativeShort.format(-Math.round(mins / 60), 'hour')
  return countdown(past, now)
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
  time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
  weekday: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
  weekdayShort: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
  /** One letter or sign per day ("M", "L", "ن"), for narrow columns. */
  weekdayNarrow: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }),
  dayMonth: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }),
  longDate: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
  shortDate: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }),
  monthYear: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
}

export function greeting(d: Date): string {
  const h = d.getHours()
  if (h < 5) return t('greet.late')
  if (h < 12) return t('greet.morning')
  if (h < 18) return t('greet.afternoon')
  return t('greet.evening')
}
