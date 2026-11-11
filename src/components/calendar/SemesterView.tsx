import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { editTarget } from '@/lib/agenda'
import { cn } from '@/lib/cn'
import { addDays, fmt, startOfDay, weekOf } from '@/lib/date'
import type { AgendaItem } from '@/types'
import { locale, t, tn } from '@/i18n'

const MAX_WEEKS = 30
const DEFAULT_WEEKS = 16
/** A week with this many deadlines and exams is marked busy. */
const BUSY = 3

// Days off: anything from a holiday calendar, or an all-day event that says it's a break.
// English and Greek, plus the common words in a few more languages.
const HOLIDAY = /holiday|break|vacation|no classes|reading week|αργ[ιί]α|διακοπ[εέ]ς|χριστο[υύ]γεννα|π[αά]σχα|καθαρ[αά] δευτ[εέ]ρα|vacaciones|feriado|vacances|f[ée]ri[ée]|ferien|feiertag|vacanze|festivit|f[ée]rias|tatil|libur|каникул|праздни/i
const isHoliday = (i: AgendaItem) =>
  i.kind === 'event' && Boolean(i.allDay) && (i.id.includes('#holiday@') || HOLIDAY.test(i.title))

const isWork = (i: AgendaItem) => i.kind === 'exam' || i.kind === 'assignment' || i.kind === 'quiz'

type Row = { start: Date; work: AgendaItem[]; off: AgendaItem[] }

const rangeFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
const weekLabel = (d: Date) => {
  try {
    return rangeFmt.formatRange(d, addDays(d, 6))
  } catch {
    return `${rangeFmt.format(d)} – ${rangeFmt.format(addDays(d, 6))}`
  }
}

/**
 * The whole term at a glance: one row per week until the term ends (the last course's end date, else 16 weeks), with
 * its exams and deadlines and any days off. Busy weeks stand out so you can start early; tap a week to open it.
 */
export function SemesterView({ now, onOpenWeek }: { now: Date; onOpenWeek: (day: Date) => void }) {
  const { agenda, courses, openEditor } = useDashboard()

  const rows = useMemo<Row[]>(() => {
    const first = weekOf(now)[0]
    const ends = courses.items.map((c) => c.term?.end).filter((e): e is string => Boolean(e)).map((e) => new Date(`${e}T00:00`))
    const termEnd = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : undefined
    const weeks = termEnd && termEnd > first
      ? Math.min(MAX_WEEKS, Math.ceil((termEnd.getTime() - first.getTime()) / (7 * 86_400_000)) + 1)
      : DEFAULT_WEEKS
    return Array.from({ length: weeks }, (_, w) => {
      const start = addDays(first, w * 7)
      const end = addDays(start, 7)
      const inWeek = agenda.filter((i) => i.date >= start && i.date < end)
      return { start, work: inWeek.filter(isWork), off: inWeek.filter(isHoliday) }
    })
  }, [agenda, courses.items, now])

  const thisWeek = weekOf(now)[0].getTime()
  const max = Math.max(BUSY, ...rows.map((r) => r.work.length))

  return (
    <div className="surface overflow-hidden">
      <ul className="separated">
        {rows.map((r) => {
          const busy = r.work.length >= BUSY
          const current = r.start.getTime() === thisWeek
          return (
            <li key={r.start.toISOString()} className={cn('flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4', current && 'bg-accent/6')}>
              <button
                onClick={() => onOpenWeek(r.start)}
                className="flex w-full shrink-0 items-center gap-2 text-left sm:w-44 sm:flex-col sm:items-start sm:gap-1"
                aria-label={t('sem.openWeek', { range: weekLabel(r.start) })}
              >
                <span className={cn('text-subhead font-semibold tabular-nums', current ? 'text-accent' : 'text-ink')}>
                  {weekLabel(r.start)}
                </span>
                <span className="flex flex-1 items-center gap-2 sm:w-full sm:flex-none">
                  <span className="relative h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-fill">
                    <span
                      className={cn('absolute inset-y-0 start-0 rounded-full', busy ? 'bg-danger' : 'bg-ink/60')}
                      style={{ width: `${(r.work.length / max) * 100}%` }}
                    />
                  </span>
                  <span className={cn('shrink-0 text-caption tabular-nums', busy ? 'font-semibold text-danger' : 'text-muted')}>
                    {current ? t('tt.thisWeek') : busy ? t('sem.busy') : r.work.length ? tn('sem.due', r.work.length) : t('sem.free')}
                  </span>
                  <ChevronRight aria-hidden className="size-3.5 shrink-0 text-faint sm:hidden" />
                </span>
              </button>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {r.off.map((i) => (
                  <span key={`off-${i.id}`} className="inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-button)] bg-course/12 px-2.5 py-1 text-caption font-medium text-course">
                    <span className="truncate">{i.title}</span>
                    <span className="shrink-0 opacity-70">{fmt.weekdayShort.format(i.date)}</span>
                  </span>
                ))}
                {r.work.map((i) => {
                  const target = editTarget(i)
                  return (
                    <button
                      key={`${i.source}-${i.id}`}
                      onClick={() => target && openEditor(target)}
                      disabled={!target}
                      className={cn(
                        'inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-button)] px-2.5 py-1 text-caption font-medium transition-colors',
                        i.kind === 'exam' ? 'bg-accent/14 text-accent enabled:hover:bg-accent/20' : 'bg-fill text-ink enabled:hover:bg-fill-strong',
                      )}
                    >
                      {i.kind === 'exam' && <span className="shrink-0 font-semibold">{t('kind.exam')}</span>}
                      <span className="truncate">{i.title}</span>
                      <span className="shrink-0 text-muted">{fmt.weekdayShort.format(i.date)}</span>
                    </button>
                  )
                })}
                {!r.work.length && !r.off.length && <span className="text-caption text-faint">{t('courses.nothingDue')}</span>}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="border-t border-line px-4 py-2.5 text-caption text-faint">
        {t('sem.footer', { date: fmt.shortDate.format(addDays(rows[rows.length - 1]?.start ?? startOfDay(now), 6)) })}
      </p>
    </div>
  )
}
