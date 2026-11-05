import { Plus } from 'lucide-react'
import { CampusClasses } from '@/components/courses/CampusClasses'
import { CourseCard } from '@/components/courses/CourseCard'
import { Timetable } from '@/components/courses/Timetable'
import { usePendingByCourse } from '@/components/courses/usePendingByCourse'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Reveal, RevealItem } from '@/components/ui/Reveal'
import { Card } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { average, formatGrade, SCALE } from '@/lib/grades'

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
        shortTitle="Courses"
        eyebrow="This semester"
        title="Courses"
        summary={
          courses.items.length > 0 &&
          `${courses.items.length} ${courses.items.length === 1 ? 'course' : 'courses'}, ${open} open ${open === 1 ? 'deadline' : 'deadlines'}, ${avg}% through on average.` +
            (grades ? ` Grade average ${formatGrade(grades.value)}/${SCALE}.` : '')
        }
        aside={
          <Button variant="primary" onClick={() => openEditor({ type: 'course' })}>
            <Plus aria-hidden className="size-4" strokeWidth={2.4} />
            Add course
          </Button>
        }
      />
      <CampusClasses />
      {courses.items.length > 0 && (
        <RevealItem className="mb-8">
          <Timetable />
        </RevealItem>
      )}
      {courses.items.length === 0 ? (
        <RevealItem>
        <Card>
          <EmptyState message="Add your courses to follow syllabus progress, deadlines and exams in one place.">
            <Button variant="primary" size="sm" onClick={() => openEditor({ type: 'course' })}>
              Add course
            </Button>
            <Button size="sm" onClick={loadSample}>
              Try sample data
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
