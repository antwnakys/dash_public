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
import { dayDiff } from '@/lib/date'

export function ExamsView() {
  const { openEditor } = useDashboard()
  const now = useNow(60_000)
  const exams = useExams(now)
  const next = exams[0]
  const days = next ? dayDiff(now, next.date) : 0

  return (
    <Reveal id="exams">
      <PageHeader
        shortTitle="Exams"
        eyebrow="Coming up"
        title="Exams"
        aside={
          <Button variant="primary" onClick={() => openEditor({ type: 'exam' })}>
            <Plus aria-hidden className="size-4" strokeWidth={2.4} />
            Add exam
          </Button>
        }
        summary={
          next &&
          `${exams.length} ${exams.length === 1 ? 'exam' : 'exams'} ahead. Next: ${next.subject} ${days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}` +
            (next.sessions.length ? `, ${next.done} of ${next.sessions.length} study sessions done.` : '.')
        }
      />
      {exams.length === 0 ? (
        <RevealItem>
          <Card>
            <EmptyState message="No exams coming up. Exams in your calendar show up here by themselves, or add one with + → Exam.">
              <Button size="sm" variant="primary" onClick={() => openEditor({ type: 'exam' })}>
                Add an exam
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
