import { useDashboard } from '@/context/DashboardContext'
import { dayEntries, type CalEntry } from '@/lib/calendarDay'
import { cn } from '@/lib/cn'
import { fmt, isSameDay } from '@/lib/date'
import { EntryChip } from './WeekGrid'
import { t } from '@/i18n'

const HOUR = 52 // px per hour

/** "09:00" on a 24-hour clock, "9 AM" on a 12-hour one, as the page's language writes times. */
const twelve = Boolean(fmt.time.resolvedOptions().hour12)
const hourFmt = new Intl.DateTimeFormat(fmt.time.resolvedOptions().locale, { hour: 'numeric' })
const hourLabel = (h: number) => (twelve ? hourFmt.format(new Date(2026, 0, 1, h)) : `${String(h).padStart(2, '0')}:00`)

/** Lanes for overlapping items, so two things at the same time sit side by side. */
function lanes(items: CalEntry[]): Array<{ entry: CalEntry; lane: number; of: number }> {
  const out: Array<{ entry: CalEntry; lane: number; of: number }> = []
  let group: typeof out = []
  let groupEnd = 0
  const flush = () => {
    const of = Math.max(1, ...group.map((g) => g.lane + 1))
    for (const g of group) out.push({ ...g, of })
    group = []
  }
  for (const entry of items) {
    const start = entry.start.getTime()
    const end = (entry.end ?? new Date(start + 60 * 60_000)).getTime()
    if (start >= groupEnd) flush()
    const used = new Set(group.filter((g) => (g.entry.end ?? new Date(g.entry.start.getTime() + 3_600_000)).getTime() > start).map((g) => g.lane))
    let lane = 0
    while (used.has(lane)) lane++
    group.push({ entry, lane, of: 1 })
    groupEnd = Math.max(groupEnd, end)
  }
  flush()
  return out
}

/** Day view: due items and all-day things on top, then an hour-by-hour timeline with a line at the current time. */
export function DayTimeline({ day, now }: { day: Date; now: Date }) {
  const { agenda, schedule } = useDashboard()
  const entries = dayEntries(day, agenda, schedule)
  const due = (e: CalEntry) => e.allDay || ((e.kind === 'assignment' || e.kind === 'task' || e.kind === 'quiz') && !e.end)
  const top = entries.filter(due)
  const timed = entries.filter((e) => !due(e))
  const first = Math.min(8, ...timed.map((e) => e.start.getHours()))
  const last = Math.max(21, ...timed.map((e) => (e.end ?? e.start).getHours() + 1))
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  const y = (d: Date) => (d.getHours() - first + d.getMinutes() / 60) * HOUR
  const today = isSameDay(day, now)

  return (
    <div className="surface overflow-hidden">
      {top.length > 0 && (
        <div className="flex flex-col gap-1.5 border-b border-line p-3">
          {top.map((e) => (
            <EntryChip key={e.key} entry={e} />
          ))}
        </div>
      )}
      <div className="relative ms-14 me-3" style={{ height: (hours.length - 1) * HOUR + 24 }}>
        {hours.map((h) => (
          <div key={h} className="absolute inset-x-0 border-t border-line" style={{ top: (h - first) * HOUR + 12 }}>
            <span className="absolute -top-2 -start-12 w-10 text-end text-caption text-faint tabular-nums">{hourLabel(h)}</span>
          </div>
        ))}
        {lanes(timed).map(({ entry, lane, of }) => {
          const end = entry.end ?? new Date(entry.start.getTime() + 60 * 60_000)
          return (
            <div
              key={entry.key}
              className="absolute"
              style={{
                top: y(entry.start) + 12,
                height: Math.max(30, y(end) - y(entry.start) - 2),
                insetInlineStart: `calc(${(lane / of) * 100}% + 2px)`,
                width: `calc(${100 / of}% - 4px)`,
              }}
            >
              <div className="h-full overflow-hidden rounded-[0.4rem] bg-surface [&>button]:h-full">
                <EntryChip entry={entry} compact />
              </div>
            </div>
          )
        })}
        {today && now.getHours() >= first && now.getHours() <= last && (
          <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger')} style={{ top: y(now) + 12 }}>
            <span className="absolute -top-[5px] -start-[5px] size-2 rounded-full bg-danger" />
          </div>
        )}
        {timed.length === 0 && (
          <p className="absolute inset-x-0 top-10 text-center text-body text-muted">{t('wk.nothingTimed')}</p>
        )}
      </div>
    </div>
  )
}
