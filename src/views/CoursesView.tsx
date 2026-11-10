import { Plus } from 'lucide-react'
import { SchoolClasses } from '@/components/courses/SchoolClasses'
import { CourseCard } from '@/components/courses/CourseCard'
import { Timetable } from '@/components/courses/Timetable'
import { CourseWorkload } from '@/components/courses/CourseWorkload'
import { usePendingByCourse } from '@/components/courses/usePendingByCourse'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Reveal, RevealItem } from '@/components/ui/Reveal'
import { Card } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { average, formatGrade, SCALE } from '@/lib/grades'
import { t, tn } from '@/i18n'

export function CoursesView() {
  const { courses, assignments, openEditor, loadSample } = useDashboard()
  const grades = average(assignments.items)
  const now = useNow(60_000)
  const pending = usePendingByCourse(now)
  const open = [...pending.values()].reduce((n, l) => n + l.length, 0)
  const avg = courses.items.length ? Math.round((courses.items.reduce((s, c) => s + c.progress, 0) / courses.items.length) * 100) : 0

  return (
    <Reveal id="courses">
      <PageHeader
        shortTitle={t('courses.title')}
        eyebrow={t('courses.eyebrow')}
        title={t('courses.title')}
        summary={
          courses.items.length > 0 &&
          t('courses.summary', { courses: tn('courses.count', courses.items.length), deadlines: tn('courses.openDeadlines', open), pct: avg }) +
            (grades ? ` ${t('courses.gradeAvg', { avg: formatGrade(grades.value), scale: SCALE })}` : '')
        }
        aside={
          <Button variant="primary" onClick={() => openEditor({ type: 'course' })}>
            <Plus aria-hidden className="size-4" strokeWidth={2.4} />
            {t('courses.add')}
          </Button>
        }
      />
      <SchoolClasses />
      {courses.items.length > 0 && (
        <RevealItem className="mb-8">
          <Timetable />
        </RevealItem>
      )}
      {courses.items.length > 0 && (
        <RevealItem className="mb-8 empty:hidden">
          <CourseWorkload now={now} />
        </RevealItem>
      )}
      {courses.items.length === 0 ? (
        <RevealItem>
        <Card>
          <EmptyState message={t('courses.empty')}>
            <Button variant="primary" size="sm" onClick={() => openEditor({ type: 'course' })}>
              {t('courses.add')}
            </Button>
            <Button size="sm" onClick={loadSample}>
              {t('courses.trySample')}
            </Button>
          </EmptyState>
        </Card>
        </RevealItem>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.items.map((c) => (
            <RevealItem key={c.id} className="flex">
              <CourseCard course={c} pending={pending.get(c.id) ?? []} now={now} />
            </RevealItem>
          ))}
        </div>
      )}
    </Reveal>
  )
}
