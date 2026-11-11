/**
 * The Home Screen and Lock Screen widgets (iPhone). The app writes a small snapshot of what's coming up (the next
 * week of classes, deadlines, exams, events and dated tasks, plus each day's leave-by time) into storage it shares
 * with the widget (an App Group); the widget picks what to show at each moment by itself, so it stays right without
 * the app being open. All text comes from here, already in the page's language.
 */
import { registerPlugin } from '@capacitor/core'
import { classesOn } from './classes'
import { planTrip } from './commute'
import { addDays, startOfDay } from './date'
import { isNative } from './native'
import type { AgendaItem, AgendaKind, Commute, Course, CourseColor } from '@/types'
import { t } from '@/i18n'

export interface WidgetItem {
  title: string
  /** Milliseconds since 1970. */
  start: number
  end?: number
  kind: AgendaKind
  allDay?: boolean
  /** Short detail: course code, room. */
  detail?: string
  /** Hex colour of the item's course, or of its kind. */
  color: string
}

export interface WidgetData {
  v: 1
  updated: number
  items: WidgetItem[]
  /** When to leave home for each day's first in-person class. */
  leave: { at: number; classAt: number; title: string }[]
  labels: {
    upNext: string
    /** Contains {time}. */
    leaveBy: string
    /** Contains {time}. */
    due: string
    nothing: string
    now: string
    today: string
    tomorrow: string
    exam: string
  }
}

const DAYS = 7
const MAX_ITEMS = 40

// Widgets can't read the page's CSS, so the colours are spelled out (they read in light and dark).
const ACCENT = '#0a84ff'
const DANGER = '#ff453a'
const hex: Record<CourseColor, string> = {
  slate: '#7a7f88',
  blue: ACCENT,
  green: '#30b350',
  amber: '#c58a1b',
  red: DANGER,
  violet: '#7c5cc4',
}
const kindColor: Partial<Record<AgendaKind, string>> = { exam: DANGER, class: '#30b350' }

export function buildWidgetData(agenda: AgendaItem[], courses: Course[], commute: Commute | undefined, now: Date): WidgetData {
  const from = startOfDay(now)
  const until = addDays(from, DAYS)
  const colorOf = (courseId: string | undefined, kind: AgendaKind) => {
    const c = courseId ? courses.find((x) => x.id === courseId)?.color : undefined
    return c ? hex[c] : (kindColor[kind] ?? ACCENT)
  }

  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i))
  const classes: WidgetItem[] = days.flatMap((d) =>
    classesOn(d, agenda, courses).map((c) => ({
      title: c.title,
      start: c.start.getTime(),
      end: c.end?.getTime(),
      kind: 'class' as const,
      detail: c.code,
      color: colorOf(c.courseId, 'class'),
    })),
  )
  const others: WidgetItem[] = agenda
    .filter((i) => i.kind !== 'class' && i.kind !== 'reminder' && i.date >= from && i.date < until)
    .map((i) => ({
      title: i.title,
      start: i.date.getTime(),
      end: i.end?.getTime(),
      kind: i.kind,
      allDay: i.allDay || undefined,
      detail: i.context || undefined,
      color: colorOf(i.courseId, i.kind),
    }))
  const items = [...classes, ...others]
    // Already over (all-day things stay for their whole day).
    .filter((i) => (i.allDay ? i.start >= from.getTime() : (i.end ?? i.start) > now.getTime()))
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_ITEMS)

  const leave = commute?.minutes
    ? days.flatMap((d) => {
        const first = classesOn(d, agenda, courses).find((c) => !c.online)
        if (!first || first.start <= now) return []
        const { leaveAt } = planTrip(first.start, { ...commute, minutes: commute.minutes! })
        return [{ at: leaveAt.getTime(), classAt: first.start.getTime(), title: first.title }]
      })
    : []

  return {
    v: 1,
    updated: now.getTime(),
    items,
    leave,
    labels: {
      upNext: t('widget.upNext'),
      leaveBy: t('leave.by', { time: '{time}' }),
      due: t('widget.due', { time: '{time}' }),
      nothing: t('widget.nothing'),
      now: t('widget.now'),
      today: t('due.today'),
      tomorrow: t('due.tomorrow'),
      exam: t('kind.exam'),
    },
  }
}

const Widget = registerPlugin<{ set(options: { json: string }): Promise<void> }>('WidgetData')

let last = ''

/** Hands the snapshot to the widgets (iPhone app only; older app builds without the plugin just skip it). */
export async function updateWidget(data: WidgetData): Promise<void> {
  if (!isNative) return
  // The timestamp changes every time; only push when what's shown would change.
  const json = JSON.stringify({ ...data, updated: 0 })
  if (json === last) return
  last = json
  await Widget.set({ json: JSON.stringify(data) }).catch(() => {
    last = ''
  })
}
