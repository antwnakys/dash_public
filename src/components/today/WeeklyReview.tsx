import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { addDays, fmt, isSameDay, weekOf } from '@/lib/date'
import { weekMinutes } from '@/lib/focusStats'
import { minutesShort } from '@/lib/setup'
import { dueText } from '@/lib/taskDue'
import type { AgendaItem } from '@/types'
import { locale, t, tn } from '@/i18n'

/** The same time of day, on another day. */
const onDay = (time: Date, day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes(), time.getSeconds())

const DUE = new Set<AgendaItem['kind']>(['assignment', 'exam', 'quiz', 'task'])

function Block({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="px-1 text-subhead font-semibold text-ink">
        {title}
        {meta && <span className="ms-2 font-normal text-muted">{meta}</span>}
      </h3>
      {children}
    </section>
  )
}

/**
 * Weekly review (Today → This week → Review, or ⌘K): what got done and how much you focused, what slipped (move it
 * to tomorrow or next Monday, or tick it), and what next week holds.
 */
export function WeeklyReview({ onDone }: { onDone: () => void }) {
  const { tasks, assignments, agenda, focusSessions, notify, setView, setSelectedDate } = useDashboard()
  const now = useNow(60_000)
  const days = weekOf(now)
  const nextMonday = addDays(days[0], 7)
  const done = tasks.tasks.filter((x) => x.done && x.completedAt && new Date(x.completedAt) >= days[0])
  const submitted = assignments.items.filter((a) => a.submitted && new Date(a.due) >= days[0] && new Date(a.due) < nextMonday).length
  const focus = weekMinutes(focusSessions.items, now)
  const slipped = tasks.tasks.filter((x) => !x.done && x.due && new Date(x.due) < now && !(x.dueAllDay && isSameDay(new Date(x.due), now)))
  const lateWork = assignments.items.filter((a) => !a.submitted && new Date(a.due) < now)
  const next = agenda.filter((i) => DUE.has(i.kind) && i.date >= nextMonday && i.date < addDays(nextMonday, 7))

  const moveTask = (id: string, due: string, to: Date) => {
    tasks.update(id, { due: onDay(new Date(due), to).toISOString() })
    notify(t('rev.moved', { day: fmt.shortDate.format(to) }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2">
        {[
          [t('rev.tasksDone'), done.length.toLocaleString(locale)],
          [t('rev.handedIn'), submitted.toLocaleString(locale)],
          [t('focus.focus'), minutesShort(focus.total)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-control)] bg-fill/60 px-3 py-2.5">
            <div className="text-caption text-muted">{label}</div>
            <div className="text-title text-ink tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <Block title={t('rev.doneWeek')}>
          <ul className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
            {done.slice(0, 8).map((x) => (
              <li key={x.id} className="flex items-center gap-2.5 px-3.5 py-2 text-body text-muted">
                <Check aria-hidden className="size-4 shrink-0 text-course" strokeWidth={2.6} />
                <span className="truncate">{x.title}</span>
              </li>
            ))}
            {done.length > 8 && <li className="px-3.5 py-2 text-subhead text-faint">{t('rev.more', { n: done.length - 8 })}</li>}
          </ul>
        </Block>
      )}

      <Block title={t('rev.stillOpen')} meta={slipped.length + lateWork.length ? tn('rev.pastDue', slipped.length + lateWork.length) : t('rev.nothingSlipped')}>
        {slipped.length + lateWork.length === 0 ? (
          <p className="px-1 text-body text-muted">{t('rev.allDone')}</p>
        ) : (
          <ul className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
            {slipped.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 px-3.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{x.title}</span>
                  <span className="block text-caption text-danger">{t('rev.wasDue', { when: dueText(x.due!, x.dueAllDay, now) })}</span>
                </span>
                <Button size="sm" onClick={() => moveTask(x.id, x.due!, addDays(now, 1))}>
                  {t('due.tomorrow')}
                </Button>
                <Button size="sm" onClick={() => moveTask(x.id, x.due!, nextMonday)}>
                  {fmt.weekday.format(nextMonday)}
                </Button>
                <Button size="sm" variant="plain" onClick={() => tasks.toggle(x.id)} aria-label={t('rev.markDone', { title: x.title })}>
                  <Check aria-hidden className="size-4" strokeWidth={2.4} />
                </Button>
              </li>
            ))}
            {lateWork.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-3.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{a.title}</span>
                  <span className="block text-caption text-danger">{t('rev.deadline', { day: fmt.shortDate.format(new Date(a.due)) })}</span>
                </span>
                <Button size="sm" onClick={() => assignments.update(a.id, { submitted: true })}>
                  {t('rev.handIn')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={t('cal.nextWeek')} meta={`${fmt.dayMonth.format(nextMonday)} – ${fmt.dayMonth.format(addDays(nextMonday, 6))}`}>
        {next.length === 0 ? (
          <p className="px-1 text-body text-muted">{t('rev.nothingNext')}</p>
        ) : (
          <ul className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
            {next.map((i) => (
              <li key={`${i.source}-${i.id}`} className="flex items-center gap-3 px-3.5 py-2">
                <span className="w-16 shrink-0 text-subhead text-muted">{fmt.weekdayShort.format(i.date)}</span>
                <span className="min-w-0 flex-1 truncate text-body text-ink">{i.title}</span>
                {i.kind === 'exam' && <span className="rounded-[0.35rem] bg-accent/12 px-1.5 py-px text-caption font-semibold text-accent">{t('rev.exam')}</span>}
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Button
        variant="primary"
        className="w-full"
        onClick={() => {
          setSelectedDate(nextMonday)
          setView('calendar')
          onDone()
        }}
      >
        {t('rev.plan')}
        <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={2.4} />
      </Button>
    </div>
  )
}
