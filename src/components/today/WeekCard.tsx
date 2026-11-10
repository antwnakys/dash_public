import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Timer } from 'lucide-react'
import { weekMinutes } from '@/lib/focusStats'
import { minutesShort } from '@/lib/setup'
import { locale, t, tn } from '@/i18n'
import { Card, Section } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { useExams } from '@/hooks/useExams'
import { cn } from '@/lib/cn'
import { addDays, countdown, fmt, isSameDay, weekOf } from '@/lib/date'
import type { AgendaItem } from '@/types'

const DUE_KINDS = new Set<AgendaItem['kind']>(['assignment', 'exam', 'quiz', 'task'])

/**
 * Today page: the week at a glance. How much got done, what's still due before Sunday, the next exam, and a
 * Monday–Sunday strip showing which days are heavy (deadlines, exams and dated tasks per day).
 */
export function WeekCard({ now }: { now: Date }) {
  const { agenda, tasks, setView, focusSessions, setFocusOpen, openEditor } = useDashboard()
  const focusWeek = weekMinutes(focusSessions.items, now).total
  const exams = useExams(now)
  const days = weekOf(now)
  const end = addDays(days[0], 7)

  const { load, dueLeft, doneThisWeek } = useMemo(() => {
    const due = agenda.filter((i) => DUE_KINDS.has(i.kind) && i.date >= days[0] && i.date < end)
    return {
      load: days.map((d) => due.filter((i) => isSameDay(i.date, d))),
      dueLeft: due.filter((i) => i.date >= now || (i.allDay && isSameDay(i.date, now))).length,
      doneThisWeek: tasks.tasks.filter((x) => x.done && x.completedAt && new Date(x.completedAt) >= days[0]).length,
    }
    // `days` and `end` follow `now`'s week.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenda, tasks.tasks, days[0].getTime(), now])

  const max = Math.max(3, ...load.map((l) => l.length))
  const next = exams[0]

  return (
    <Section
      title={t('week.title')}
      action={
        <div className="flex items-center gap-1">
          <Button size="sm" variant="plain" onClick={() => setFocusOpen(true)} title={`${t('focus.title')} (F)`}>
            <Timer aria-hidden className="size-4" strokeWidth={2.2} />
            {t('focus.title')}
          </Button>
          <Button size="sm" variant="plain" onClick={() => openEditor({ type: 'review' })}>
            {t('week.review')}
          </Button>
        </div>
      }
    >
      <Card className="px-4 py-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
          <div>
            <dt className="text-caption text-muted">{t('week.done')}</dt>
            <dd className="text-title tabular-nums text-ink">{doneThisWeek.toLocaleString(locale)}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted">{t('week.dueBy', { day: fmt.weekday.format(days[6]) })}</dt>
            <dd className={cn('text-title tabular-nums', dueLeft > 5 ? 'text-danger' : 'text-ink')}>{dueLeft.toLocaleString(locale)}</dd>
          </div>
          <button onClick={() => setFocusOpen(true)} className="min-w-0 text-start">
            <dt className="text-caption text-muted">{t('focus.focus')}</dt>
            <dd className="truncate text-title tabular-nums text-ink">{minutesShort(focusWeek)}</dd>
          </button>
          <button onClick={() => setView('exams')} className="min-w-0 text-start">
            <dt className="text-caption text-muted">{t('week.nextExam')}</dt>
            <dd className="truncate text-headline text-ink">{next ? next.subject : '—'}</dd>
            {next && <dd className="text-caption text-accent">{countdown(next.date, now)}</dd>}
          </button>
        </dl>
        <div className="mt-4 grid grid-cols-7 gap-1.5" role="list" aria-label={t('week.perDay')}>
          {days.map((d, i) => {
            const n = load[i].length
            const today = isSameDay(d, now)
            const past = d < now && !today
            return (
              <div
                key={d.toISOString()}
                role="listitem"
                title={load[i].map((x) => x.title).join('\n') || t('week.nothingDue')}
                aria-label={`${fmt.weekday.format(d)}: ${tn('week.due', n)}`}
                className="flex flex-col items-center gap-1"
              >
                <div className="flex h-12 w-full items-end justify-center rounded-[0.4rem] bg-fill">
                  <div
                    className={cn('w-full rounded-[0.4rem] transition-[height]', today ? 'bg-accent' : past ? 'bg-faint/50' : 'bg-ink/70')}
                    style={{ height: n ? `${Math.max(18, (n / max) * 100)}%` : 0 }}
                  />
                </div>
                <span className={cn('text-caption tabular-nums', today ? 'font-semibold text-accent' : 'text-muted')}>
                  {fmt.weekdayNarrow.format(d)}
                </span>
              </div>
            )
          })}
        </div>
      </Card>
    </Section>
  )
}
