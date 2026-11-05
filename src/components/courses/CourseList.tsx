import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Countdown } from '@/components/ui/Countdown'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressRing } from '@/components/ui/ProgressBar'
import { Card, Section } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { usePendingByCourse } from './usePendingByCourse'

/** Compact course rows for the Today screen. */
export function CourseList() {
  const { courses, openEditor, setView, loadSample } = useDashboard()
  const now = useNow(60_000)
  const pending = usePendingByCourse(now)

  return (
    <Section
      title="Courses"
      action={
        courses.items.length > 0 && (
          <Button variant="plain" size="sm" onClick={() => setView('courses')}>
            See all
          </Button>
        )
      }
    >
      <Card>
        {courses.items.length === 0 ? (
          <EmptyState message="Add your courses to follow progress and deadlines in one place.">
            <Button variant="primary" size="sm" onClick={() => openEditor({ type: 'course' })}>
              Add course
            </Button>
            <Button size="sm" onClick={loadSample}>
              Try sample data
            </Button>
          </EmptyState>
        ) : (
          <ul className="separated">
            {courses.items.map((c) => {
              const next = pending.get(c.id)?.[0]
              return (
                <li key={c.id}>
                  <button
                    onClick={() => openEditor({ type: 'course', id: c.id })}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-fill active:bg-fill-strong"
                  >
                    <ProgressRing value={c.progress} label={`${c.name} syllabus`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">{c.name}</span>
                      <span className="block truncate text-subhead text-muted">
                        {next ? next.title : c.code || 'Nothing due'}
                      </span>
                    </span>
                    {next ? <Countdown date={new Date(next.due)} now={now} /> : <ChevronRight aria-hidden className="size-4 text-faint" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </Section>
  )
}
