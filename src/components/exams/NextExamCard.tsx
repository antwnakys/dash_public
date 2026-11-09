import { ChevronRight, ClipboardCheck } from 'lucide-react'
import { LinkButton } from '@/components/ui/LinkButton'
import { useDashboard } from '@/context/DashboardContext'
import { useExams } from '@/hooks/useExams'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/cn'
import { dayDiff, fmt, isSameDay } from '@/lib/date'
import { t, tn } from '@/i18n'

const SHOW_WITHIN_DAYS = 14

/** On Today: the next exam's countdown and today's (or the next) study session. Opens the Exams tab. */
export function NextExamCard() {
  const { setView } = useDashboard()
  const now = useNow(60_000)
  const exam = useExams(now)[0]
  if (!exam) return null
  const days = dayDiff(now, exam.date)
  if (days > SHOW_WITHIN_DAYS) return null

  const headline =
    days <= 0
      ? exam.allDay
        ? t('next.today', { subject: exam.subject })
        : t('next.todayAt', { subject: exam.subject, time: fmt.time.format(exam.date) })
      : days === 1
        ? t('next.tomorrow', { subject: exam.subject })
        : tn('next.inDays', days, { subject: exam.subject })
  const s = exam.next
  const sessionLine = s
    ? `${isSameDay(s.start, now) ? (s.start <= now ? t('next.now') : t('next.todayTime', { time: fmt.time.format(s.start) })) : `${fmt.shortDate.format(s.start)} ${fmt.time.format(s.start)}`}: ${s.topic}`
    : exam.sessions.length
      ? t('next.allDone')
      : t('next.noPlan')

  return (
    <div className="surface flex items-center gap-2 pe-3">
    <button onClick={() => setView('exams')} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-[var(--radius-card)] px-4 py-3.5 text-start transition-colors hover:bg-fill/60">
      <span
        aria-hidden
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', days <= 2 ? 'bg-danger/14 text-danger' : 'bg-accent/12 text-accent')}
      >
        <ClipboardCheck className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline text-ink">{headline}</span>
        <span className="block truncate text-subhead text-muted">{sessionLine}</span>
        {exam.sessions.length > 0 && (
          <span className="block text-caption text-faint tabular-nums">
            {t('next.sessionsDone', { done: exam.done, total: exam.sessions.length })}
          </span>
        )}
      </span>
      {!exam.url && <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />}
    </button>
    {exam.url && <LinkButton url={exam.url} compact />}
    </div>
  )
}
