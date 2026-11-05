import { findMeetingLink, findOtherLink, looksOnline } from './meeting'
import type { CalendarEvent } from '@/types'

interface Prop {
  value: string
  params: Record<string, string>
}

type VEvent = Record<string, Prop[]>

const DAY_MS = 86_400_000
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** Milliseconds `tz` is ahead of UTC at instant `utc`. */
function tzOffset(utc: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utc))
  const get = (t: string) => +parts.find((p) => p.type === t)!.value
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - utc
}

/** Parse an ICS DATE or DATE-TIME, honouring a TZID parameter when the runtime knows the zone. */
function parseIcsDate(value: string, tz?: string): { date: Date; allDay: boolean } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  if (h === undefined) return { date: new Date(+y, +mo - 1, +d), allDay: true }
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))
  if (z) return { date: new Date(wall), allDay: false }
  if (tz) {
    try {
      // Two passes settle the offset across DST boundaries.
      let utc = wall - tzOffset(wall, tz)
      utc = wall - tzOffset(utc, tz)
      return { date: new Date(utc), allDay: false }
    } catch {
      // Unknown zone name: fall through to device-local time.
    }
  }
  return { date: new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)), allDay: false }
}

const unescape = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim()

function parseLine(line: string): [string, Prop] | null {
  const i = line.indexOf(':')
  if (i < 0) return null
  const [name, ...rawParams] = line.slice(0, i).split(';')
  const params: Record<string, string> = {}
  for (const p of rawParams) {
    const [k, v] = p.split('=')
    if (k && v) params[k.toUpperCase()] = v.replace(/^"|"$/g, '')
  }
  return [name.toUpperCase(), { value: line.slice(i + 1), params }]
}

function readEvents(text: string): VEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const out: VEvent[] = []
  let cur: VEvent | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {}
    else if (line === 'END:VEVENT') {
      if (cur) out.push(cur)
      cur = null
    } else if (cur) {
      const parsed = parseLine(line)
      if (parsed) (cur[parsed[0]] ??= []).push(parsed[1])
    }
  }
  return out
}

const dateOf = (p?: Prop) => (p ? parseIcsDate(p.value, p.params.TZID) : null)

/** Occurrence start times of a recurring event inside [from, to]. Covers the rules calendars commonly emit. */
function expand(start: Date, rrule: string, from: number, to: number, skip: Set<number>): Date[] {
  const rule = Object.fromEntries(rrule.split(';').map((kv) => kv.split('=') as [string, string]))
  const interval = Math.max(1, +(rule.INTERVAL ?? 1))
  const count = rule.COUNT ? +rule.COUNT : Infinity
  const until = rule.UNTIL ? (parseIcsDate(rule.UNTIL)?.date.getTime() ?? Infinity) : Infinity
  const byDay = rule.BYDAY?.split(',')
    .map((d) => WEEKDAYS.indexOf(d.slice(-2)))
    .filter((d) => d >= 0)
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))

  const out: Date[] = []
  let produced = 0
  const emit = (d: Date) => {
    const t = d.getTime()
    if (t < start.getTime()) return true
    if (t > until || t > to || produced >= count) return false
    produced++
    if (t >= from && !skip.has(t)) out.push(d)
    return true
  }

  for (let n = 0; n < 2000; n++) {
    const base = new Date(start)
    if (rule.FREQ === 'DAILY') base.setDate(base.getDate() + n * interval)
    else if (rule.FREQ === 'WEEKLY') base.setDate(base.getDate() + n * interval * 7)
    else if (rule.FREQ === 'MONTHLY') base.setMonth(base.getMonth() + n * interval)
    else if (rule.FREQ === 'YEARLY') base.setFullYear(base.getFullYear() + n * interval)
    else return out

    if (rule.FREQ === 'WEEKLY' && byDay?.length) {
      const monday = new Date(base)
      monday.setDate(base.getDate() - ((base.getDay() + 6) % 7))
      for (const wd of byDay) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + ((wd + 6) % 7))
        if (!emit(d)) return out
      }
    } else if (!emit(base)) return out
  }
  return out
}

/**
 * Events from iCalendar text (a Google Calendar secret address, an .ics export, a school feed…)
 * between `from` and `to`. Recurring events are expanded, edited instances and cancellations respected.
 */
export function parseIcs(
  text: string,
  { from = Date.now() - 7 * DAY_MS, to = Date.now() + 365 * DAY_MS, idPrefix = 'ics' } = {},
): CalendarEvent[] {
  const events = readEvents(text)
  const out: CalendarEvent[] = []

  // Instances moved or cancelled individually carry a RECURRENCE-ID; the series must skip them.
  const overridden = new Map<string, Set<number>>()
  for (const ev of events) {
    const rid = dateOf(ev['RECURRENCE-ID']?.[0])
    const uid = ev.UID?.[0]?.value
    if (rid && uid) (overridden.get(uid) ?? overridden.set(uid, new Set()).get(uid)!).add(rid.date.getTime())
  }

  for (const ev of events) {
    const summary = ev.SUMMARY?.[0]?.value
    const start = dateOf(ev.DTSTART?.[0])
    if (!summary || !start || ev.STATUS?.[0]?.value === 'CANCELLED') continue

    const uid = ev.UID?.[0]?.value ?? `${summary}-${ev.DTSTART![0].value}`
    const location = ev.LOCATION?.[0] ? unescape(ev.LOCATION[0].value) || undefined : undefined
    const description = ev.DESCRIPTION?.[0] ? unescape(ev.DESCRIPTION[0].value) : undefined
    const link = findMeetingLink(description, location, ev.URL?.[0]?.value)
    const base = {
      title: unescape(summary),
      allDay: start.allDay || undefined,
      location,
      link,
      url: findOtherLink(description, location, ev.URL?.[0]?.value),
      online: looksOnline(link, summary, description) || undefined,
      kind: 'event' as const,
    }
    const rrule = ev.RRULE?.[0]?.value
    const endsAt = dateOf(ev.DTEND?.[0])
    const duration = !start.allDay && endsAt ? endsAt.date.getTime() - start.date.getTime() : 0
    const end = (d: Date) => (duration > 0 ? new Date(d.getTime() + duration).toISOString() : undefined)

    if (rrule && !ev['RECURRENCE-ID']) {
      const skip = new Set(overridden.get(uid))
      for (const ex of ev.EXDATE ?? []) {
        for (const v of ex.value.split(',')) {
          const d = parseIcsDate(v, ex.params.TZID)
          if (d) skip.add(d.date.getTime())
        }
      }
      for (const d of expand(start.date, rrule, from, to, skip)) {
        out.push({ ...base, id: `${idPrefix}-${uid}-${d.getTime()}`, start: d.toISOString(), end: end(d) })
      }
    } else {
      const t = start.date.getTime()
      if (t >= from && t <= to) out.push({ ...base, id: `${idPrefix}-${uid}-${t}`, start: start.date.toISOString(), end: end(start.date) })
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}
