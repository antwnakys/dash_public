import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ExamCard } from '@/components/exams/ExamCard'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Reveal, RevealItem } from '@/components/ui/Reveal'
import { Card } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { useExams } from '@/hooks/useExams'
import { useNow } from '@/hooks/useNow'
import { dayDiff, inDays } from '@/lib/date'
import { t, tn } from '@/i18n'

export function ExamsView() {
  const { openEditor } = useDashboard()
  const now = useNow(60_000)
  const exams = useExams(now)
  const next = exams[0]
  const days = next ? dayDiff(now, next.date) : 0

  return (
    <Reveal id="exams">
      <PageHeader
        shortTitle={t('exams.title')}
        eyebrow={t('exams.eyebrow')}
        title={t('exams.title')}
        aside={
          <Button variant="primary" onClick={() => openEditor({ type: 'exam' })}>
            <Plus aria-hidden className="size-4" strokeWidth={2.4} />
            {t('exams.add')}
          </Button>
        }
        summary={
          next &&
          `${tn('exams.ahead', exams.length)} ${t('exams.next', { subject: next.subject, when: inDays(Math.max(0, days)) })}` +
            (next.sessions.length ? ` ${t('exams.sessionsDone', { done: next.done, total: next.sessions.length })}` : '')
        }
      />
      {exams.length === 0 ? (
        <RevealItem>
          <Card>
            <EmptyState message={t('exams.empty')}>
              <Button size="sm" variant="primary" onClick={() => openEditor({ type: 'exam' })}>
                {t('exams.addOne')}
              </Button>
            </EmptyState>
          </Card>
        </RevealItem>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          {exams.map((e, i) => (
            <RevealItem key={e.id}>
              <ExamCard exam={e} now={now} open={i === 0} />
            </RevealItem>
          ))}
        </div>
      )}
    </Reveal>
  )
}
