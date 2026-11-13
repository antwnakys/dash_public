/**
 * Quick add: reads a typed line like "Finish economics assignment tomorrow at 18:00 !! #college every week"
 * into a task. Only clear phrases are taken; anything unsure stays in the title. The result lists what was
 * understood (`parts`) so the add box can show it before saving, and each part can be undone.
 *
 * Understood (English, with the common Greek words for days):
 * - days: today, tonight, tomorrow (tmr), day after tomorrow, monday…sunday (mon–fri also short; "sat"/"sun" must be
 *   written out), "next friday" (the Friday of next week), "in 3 days", "in 2 weeks", 12/11, 12-11, 12/11/2026, 12.11.2026, "12 nov", "nov 12"
 *   (day first, as in Greece); Greek: σήμερα, αύριο, μεθαύριο, Δευτέρα…Κυριακή
 * - times: "at 18:00", 18:00, 18.30, 6pm, 6:30pm, "at 6" (with a day or "at")
 * - priority: !, !!, !!! (low, medium, high) or p1/p2/p3 (high, medium, low)
 * - category: #college, #personal, #projects (also #uni, #work, #project)
 * - repeat: daily / every day, weekdays / every weekday, weekly / every week, monthly / every month,
 *   "every monday" (weekly on that day)
 * - in the other languages also that language's today, tomorrow, the day after and weekday names, taken from
 *   the browser's own date names (`localRules`), so "Ensayo viernes 18:00" works in Spanish
 */
import { addDays, startOfDay, weekOf } from './date'
import { lang, locale, t } from '@/i18n'
import { student } from './role'
import type { Task, TaskCategory, TaskPriority, TaskRepeat } from '@/types'

export type QuickPartKind = 'due' | 'priority' | 'category' | 'repeat' | 'tags'

export interface QuickPart {
  kind: QuickPartKind
  /** The exact text that was read, as typed. */
  text: string
}

export interface QuickTask {
  title: string
  due?: string
  dueAllDay?: boolean
  priority?: TaskPriority
  category?: TaskCategory
  repeat?: TaskRepeat
  /** Other #words ("#reading #lab"), lower case. */
  tags?: string[]
  parts: QuickPart[]
}

const WEEKDAYS: Array<[RegExp, number]> = [
  [/^(sunday|κυριακ[ηή])$/i, 0],
  [/^(mon(day)?|δευτ[εέ]ρα)$/i, 1],
  [/^(tue(s|sday)?|τρ[ιί]τη)$/i, 2],
  [/^(wed(nesday)?|τετ[αά]ρτη)$/i, 3],
  [/^(thu(r|rs|rsday)?|π[εέ]μπτη)$/i, 4],
  [/^(fri(day)?|παρασκευ[ηή])$/i, 5],
  [/^(saturday|σ[αά]ββατο)$/i, 6],
]
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const weekdayOf = (word: string) => WEEKDAYS.find(([re]) => re.test(word))?.[1]
const monthOf = (word: string) => {
  const i = MONTHS.indexOf(word.slice(0, 3).toLowerCase())
  return i >= 0 && /^[a-z]+$/i.test(word) ? i : undefined
}

/** Next date (today counts) that falls on `weekday`; `nextWeek` picks that day in next week (Monday to Sunday). */
function nextWeekday(now: Date, weekday: number, nextWeek = false): Date {
  let d = nextWeek ? addDays(weekOf(now)[0], 7) : startOfDay(now)
  for (let i = 0; i < 7; i++) {
    if (d.getDay() === weekday) return d
    d = addDays(d, 1)
  }
  return d
}

/** A day/month in the future: this year, or next year if it already passed. */
function dayMonth(now: Date, day: number, month: number, year?: number): Date | undefined {
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined
  const y = year === undefined ? now.getFullYear() : year < 100 ? 2000 + year : year
  let d = new Date(y, month, day)
  if (d.getMonth() !== month) return undefined
  if (year === undefined && d < startOfDay(now)) d = new Date(y + 1, month, day)
  return d
}

interface Match {
  start: number
  end: number
}

type Rule = { re: RegExp; kind: QuickPartKind; apply: (m: RegExpExecArray, out: Draft, now: Date) => boolean }

interface Draft {
  tags?: string[]
  day?: Date
  /** The day came from a weekday name, so "monday" said on a Monday evening means next week once the time has passed. */
  weekday?: boolean
  /** "tonight": a time like "at 9" means 21:00. */
  tonight?: boolean
  time?: [number, number]
  priority?: TaskPriority
  category?: TaskCategory
  repeat?: TaskRepeat
}

const time24 = (h: number, m: number): [number, number] | undefined => (h < 24 && m < 60 ? [h, m] : undefined)
function time12(h: number, m: number, ampm: string): [number, number] | undefined {
  if (h < 1 || h > 12 || m > 59) return undefined
  const pm = ampm.toLowerCase().startsWith('p')
  return [(h % 12) + (pm ? 12 : 0), m]
}

// Order matters: longer phrases first, so "day after tomorrow" isn't read as "tomorrow".
const RULES: Rule[] = [
  { re: /\b(?:every\s+weekday|weekdays)\b/i, kind: 'repeat', apply: (_, o) => ((o.repeat = 'weekdays'), true) },
  {
    re: /\bevery\s+(sunday|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|saturday)\b/i,
    kind: 'repeat',
    apply: (m, o, now) => {
      o.repeat = 'weekly'
      if (!o.day) {
        o.day = nextWeekday(now, weekdayOf(m[1])!)
        o.weekday = true
      }
      return true
    },
  },
  { re: /\b(?:every\s+day|daily)\b/i, kind: 'repeat', apply: (_, o) => ((o.repeat = 'daily'), true) },
  { re: /\b(?:every\s+week|weekly)\b/i, kind: 'repeat', apply: (_, o) => ((o.repeat = 'weekly'), true) },
  { re: /\b(?:every\s+month|monthly)\b/i, kind: 'repeat', apply: (_, o) => ((o.repeat = 'monthly'), true) },
  { re: /(?:^|\s)(!{1,3})(?=\s|$)/, kind: 'priority', apply: (m, o) => ((o.priority = (4 - m[1].length) as TaskPriority), true) },
  { re: /\bp([123])\b/i, kind: 'priority', apply: (m, o) => ((o.priority = Number(m[1]) as TaskPriority), true) },
  {
    re: /(?:^|\s)#(college|uni|school|personal|me|projects?|work)\b/i,
    kind: 'category',
    apply: (m, o) => {
      const w = m[1].toLowerCase()
      // Not a student, "college" is the Work category, so #work goes there.
      o.category = w === 'personal' || w === 'me' ? 'personal' : w.startsWith('project') || (w === 'work' && student) ? 'projects' : 'college'
      return true
    },
  },
  { re: /\b(?:the\s+)?day\s+after\s+tomorrow\b|(?<!\p{L})μεθ[αά][υύ]ριο(?!\p{L})/iu, kind: 'due', apply: (_, o, now) => ((o.day = addDays(startOfDay(now), 2)), true) },
  { re: /\b(?:tomorrow|tmr|tmrw)\b|(?<!\p{L})[αά][υύ]ριο(?!\p{L})/iu, kind: 'due', apply: (_, o, now) => ((o.day = addDays(startOfDay(now), 1)), true) },
  { re: /\btoday\b|(?<!\p{L})σ[ηή]μερα(?!\p{L})/iu, kind: 'due', apply: (_, o, now) => ((o.day = startOfDay(now)), true) },
  {
    re: /\btonight\b/i,
    kind: 'due',
    apply: (_, o, now) => {
      o.day = startOfDay(now)
      o.tonight = true
      return true
    },
  },
  {
    re: /\bin\s+(\d{1,2})\s+(days?|weeks?)\b/i,
    kind: 'due',
    apply: (m, o, now) => {
      const n = Number(m[1]) * (m[2].toLowerCase().startsWith('w') ? 7 : 1)
      o.day = addDays(startOfDay(now), n)
      return n > 0
    },
  },
  {
    re: /(?<![\p{L}\p{N}])(?:(next|on|this|την|το)\s+)?(sunday|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|saturday|κυριακ[ηή]|δευτ[εέ]ρα|τρ[ιί]τη|τετ[αά]ρτη|π[εέ]μπτη|παρασκευ[ηή]|σ[αά]ββατο)(?![\p{L}\p{N}])/iu,
    kind: 'due',
    apply: (m, o, now) => {
      const wd = weekdayOf(m[2])
      // "every monday" is a repeat; if that reading was undone, the whole phrase stays in the title.
      if (wd === undefined || /every\s*$/i.test(m.input.slice(0, m.index))) return false
      o.day = nextWeekday(now, wd, m[1]?.toLowerCase() === 'next')
      o.weekday = true
      return true
    },
  },
  {
    // 12/11, 12-11, 12/11/26, 12.11.2026 (day first). "18.05" without a year is a time, so dots need the year.
    re: /\b(\d{1,2})([/.-])(\d{1,2})(?:\2(\d{2}|\d{4}))?\b(?!:)/,
    kind: 'due',
    apply: (m, o, now) => {
      if (m[2] === '.' && !m[4]) return false
      const d = dayMonth(now, Number(m[1]), Number(m[3]) - 1, m[4] ? Number(m[4]) : undefined)
      if (!d) return false
      o.day = d
      return true
    },
  },
  {
    re: /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i,
    kind: 'due',
    apply: (m, o, now) => {
      const d = dayMonth(now, Number(m[1]), monthOf(m[2])!)
      if (!d) return false
      o.day = d
      return true
    },
  },
  {
    re: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/i,
    kind: 'due',
    apply: (m, o, now) => {
      const d = dayMonth(now, Number(m[2]), monthOf(m[1])!)
      if (!d) return false
      o.day = d
      return true
    },
  },
  {
    re: /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
    kind: 'due',
    apply: (m, o) => {
      const t = time12(Number(m[1]), Number(m[2] ?? 0), m[3])
      if (!t) return false
      o.time = t
      return true
    },
  },
  {
    re: /\b(?:at\s+)?(\d{1,2})[:.](\d{2})\b/i,
    kind: 'due',
    apply: (m, o) => {
      const t = time24(Number(m[1]), Number(m[2]))
      if (!t) return false
      o.time = t
      return true
    },
  },
  {
    // "at 6" / "at 18": only with the word "at".
    re: /\bat\s+(\d{1,2})\b(?![:./])/i,
    kind: 'due',
    apply: (m, o) => {
      const h = Number(m[1])
      // "at 6" means the evening for 1–7 (people rarely set tasks at 6 in the morning).
      const t = time24(h >= 1 && h <= 7 ? h + 12 : h, 0)
      if (!t) return false
      o.time = t
      return true
    },
  },
]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC')
// Chinese and Japanese don't put spaces between words, so their words are matched anywhere in the line.
const noSpaces = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

function wordRe(words: string[]): RegExp {
  const list = [...new Set(words.flatMap((w) => [w, plain(w), w.replace(/’/g, "'")]).map((w) => w.toLocaleLowerCase(locale)))]
    .sort((a, b) => b.length - a.length)
  const spaced = list.filter((w) => !noSpaces.test(w)).map(escape)
  const dense = list.filter((w) => noSpaces.test(w)).map(escape)
  const parts = []
  if (spaced.length) parts.push(`(?<![\\p{L}\\p{M}\\p{N}])(?:${spaced.join('|')})(?![\\p{L}\\p{M}\\p{N}])`)
  if (dense.length) parts.push(`(?:${dense.join('|')})`)
  return new RegExp(parts.join('|'), 'iu')
}

/** Today, tomorrow, the day after and the weekdays in the app's language (English and Greek have their own rules). */
function localRules(): Rule[] {
  if (lang === 'en' || lang === 'el') return []
  try {
    const rel = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    const rules: Rule[] = []
    for (const n of [2, 1, 0]) {
      const word = rel.format(n, 'day')
      // Hindi and Urdu use one word for yesterday and tomorrow; leave it to the date pickers.
      if (n === 1 && word === rel.format(-1, 'day')) continue
      if (/\d/.test(word) && n !== 2) continue
      rules.push({ re: wordRe([word]), kind: 'due', apply: (_, o, now) => ((o.day = addDays(startOfDay(now), n)), true) })
    }
    const long = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    // 4 Jan 2026 was a Sunday.
    for (let wd = 0; wd < 7; wd++) {
      const word = long.format(new Date(2026, 0, 4 + wd))
      rules.push({
        re: wordRe([word]),
        kind: 'due',
        apply: (_, o, now) => {
          o.day = nextWeekday(now, wd)
          o.weekday = true
          return true
        },
      })
    }
    return rules
  } catch {
    return []
  }
}

RULES.push(...localRules())

/** Read a typed line. `ignore` lists part kinds the user undid, which then stay in the title. */
export function parseQuickAdd(input: string, now = new Date(), ignore: QuickPartKind[] = []): QuickTask {
  const draft: Draft = {}
  const taken: Match[] = []
  const parts: QuickPart[] = []
  const overlaps = (a: Match) => taken.some((b) => a.start < b.end && b.start < a.end)

  for (const rule of RULES) {
    if (ignore.includes(rule.kind)) continue
    const re = new RegExp(rule.re.source, rule.re.flags.replace('g', '') + 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(input))) {
      // Leading whitespace captured by (?:^|\s) isn't part of the phrase.
      const lead = m[0].length - m[0].trimStart().length
      const match = { start: m.index + lead, end: m.index + m[0].length }
      if (overlaps(match)) continue
      const before = JSON.stringify(draft)
      if (!rule.apply(m, draft, now)) {
        Object.assign(draft, JSON.parse(before))
        continue
      }
      taken.push(match)
      parts.push({ kind: rule.kind, text: input.slice(match.start, match.end) })
      break
    }
  }

  // Any other #word is a tag.
  if (!ignore.includes('tags')) {
    const re = /(?:^|\s)#([\p{L}\p{N}_-]{2,30})/gu
    let m: RegExpExecArray | null
    while ((m = re.exec(input))) {
      const lead = m[0].length - m[0].trimStart().length
      const match = { start: m.index + lead, end: m.index + m[0].length }
      if (overlaps(match)) continue
      taken.push(match)
      draft.tags = [...(draft.tags ?? []), m[1].toLocaleLowerCase()]
      parts.push({ kind: 'tags', text: input.slice(match.start, match.end) })
    }
  }

  // The title is what's left, tidied: no doubled spaces or dangling "at"/"on"/"by".
  let title = input
  for (const t of [...taken].sort((a, b) => b.start - a.start)) title = title.slice(0, t.start) + ' ' + title.slice(t.end)
  title = title
    .replace(/\s+(?:at|on|by|due|για|στις)\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const out: QuickTask = { title: title || input.trim(), parts, priority: draft.priority, category: draft.category, tags: draft.tags }
  if (draft.day || draft.time) {
    let day = draft.day ?? startOfDay(now)
    // A time alone that has already passed today means tomorrow.
    if (!draft.day && draft.time && (draft.time[0] < now.getHours() || (draft.time[0] === now.getHours() && draft.time[1] <= now.getMinutes())))
      day = addDays(day, 1)
    const [h, m] = draft.tonight ? (draft.time ? [draft.time[0] < 12 ? draft.time[0] + 12 : draft.time[0], draft.time[1]] : [20, 0]) : (draft.time ?? [23, 59])
    let due = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
    if (draft.weekday && due < now) due = addDays(due, 7)
    out.due = due.toISOString()
    out.dueAllDay = draft.time || draft.tonight ? undefined : true
  }
  if (draft.repeat) {
    out.repeat = draft.repeat
    // A repeating task needs a date to repeat from.
    if (!out.due) {
      const d = draft.repeat === 'weekdays' && [0, 6].includes(now.getDay()) ? nextWeekday(now, 1) : startOfDay(now)
      out.due = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59).toISOString()
      out.dueAllDay = true
    }
  }
  return out
}

/** The next due date of a repeating task, after `from` (its current due date). */
export function nextRepeat(due: Date, repeat: TaskRepeat): Date {
  const d = new Date(due)
  if (repeat === 'daily') d.setDate(d.getDate() + 1)
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7)
  else if (repeat === 'monthly') {
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  } else {
    do d.setDate(d.getDate() + 1)
    while (d.getDay() === 0 || d.getDay() === 6)
  }
  return d
}

export const repeatLabel: Record<TaskRepeat, string> = {
  daily: t('rep.daily'),
  weekdays: t('rep.weekdays'),
  weekly: t('rep.weekly'),
  monthly: t('rep.monthly'),
}

export const priorityLabel: Record<TaskPriority, string> = { 1: t('prio.high'), 2: t('prio.medium'), 3: t('prio.low') }

/** Fields a quick-add result sets on a new task. */
export const quickFields = (q: QuickTask): Partial<Task> => ({
  due: q.due,
  dueAllDay: q.dueAllDay,
  priority: q.priority,
  repeat: q.repeat,
  tags: q.tags,
})
