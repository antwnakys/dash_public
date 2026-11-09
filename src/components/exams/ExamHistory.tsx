import { Check, ChevronRight, Minus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, Section } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { t } from '@/i18n'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/date'
import { examHistory, resultTarget, type Exam } from '@/lib/exams'
import { formatGrade } from '@/lib/grades'
import type { ExamResult } from '@/types'

const when = (date: Date, allDay?: boolean) => (allDay ? fmt.shortDate.format(date) : `${fmt.shortDate.format(date)}, ${fmt.time.format(date)}`)

/** Finished exams without a result: add one, or skip to file it under history without a score. */
export function AwaitingResults({ exams }: { exams: Exam[] }) {
  const { openEditor, examResults, notify } = useDashboard()
  if (!exams.length) return null
  const skip = (exam: Exam) => {
    examResults.set((list) => [
      ...list.filter((r) => r.id !== exam.id),
      { id: exam.id, subject: exam.subject, date: exam.date.toISOString(), allDay: exam.allDay, courseId: exam.courseId },
    ])
    notify(t('res.skipped'))
  }
  return (
    <Section title={t('res.awaiting')}>
      <Card>
        <ul className="separated">
          {exams.map((exam) => (
            <li key={exam.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-ink">{exam.subject}</span>
                <span className="block text-subhead text-muted tabular-nums">{when(exam.date, exam.allDay)}</span>
              </span>
              <Button size="sm" variant="plain" onClick={() => skip(exam)}>
                {t('res.skip')}
              </Button>
              <Button size="sm" variant="primary" onClick={() => openEditor(resultTarget(exam))}>
                {t('res.add')}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  )
}

function Outcome({ result }: { result: ExamResult }) {
  const Icon = result.passed === true ? Check : result.passed === false ? X : Minus
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full',
        result.passed === true ? 'bg-course/14 text-course' : result.passed === false ? 'bg-danger/14 text-danger' : 'bg-fill text-faint',
      )}
    >
      <Icon className="size-4" strokeWidth={2.6} />
    </span>
  )
}

/** Every exam with a result, newest first; tap one to change it. */
export function ExamHistory() {
  const { examResults, openEditor } = useDashboard()
  const { list, passed, failed } = examHistory(examResults.items)
  if (!list.length) return null
  return (
    <Section title={t('res.history')} meta={[passed && t('res.passedCount', { n: passed }), failed && t('res.failedCount', { n: failed })].filter(Boolean).join(' · ')}>
      <Card>
        <ul className="separated">
          {list.map((r) => (
            <li key={r.id}>
              <button
                onClick={() =>
                  openEditor({ type: 'examResult', id: r.id, subject: r.subject, date: r.date, allDay: r.allDay, courseId: r.courseId })
                }
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-fill active:bg-fill-strong"
              >
                <Outcome result={r} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-ink">{r.subject}</span>
                  <span className="block text-subhead text-muted tabular-nums">
                    {[
                      when(new Date(r.date), r.allDay),
                      r.passed === true ? t('res.passed') : r.passed === false ? t('res.failed') : t('res.noResult'),
                    ].join(' · ')}
                  </span>
                </span>
                {r.score != null && (
                  <span className="shrink-0 text-headline text-ink tabular-nums">
                    {formatGrade(r.score)}
                    <span className="text-subhead text-muted">/{formatGrade(r.outOf ?? 10)}</span>
                  </span>
                )}
                <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  )
}
