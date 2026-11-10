import { Card, Section } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { courseColors } from '@/lib/courseColor'
import { addDays } from '@/lib/date'
import { matchCourse } from '@/lib/school'
import { joinList, t, tn } from '@/i18n'

const DAYS = 14

/**
 * Courses: which ones need work in the next two weeks. Deadlines and exams per course (plus open tasks that name
 * it), heaviest first, as bars, so the busy courses stand out.
 */
export function CourseWorkload({ now }: { now: Date }) {
  const { courses, assignments, tasks, openEditor } = useDashboard()
  const until = addDays(now, DAYS)
  const rows = courses.items
    .map((c) => {
      const work = assignments.items.filter((a) => a.courseId === c.id && !a.submitted && new Date(a.due) < until)
      const exams = work.filter((a) => a.kind === 'exam').length
      const relatedTasks = tasks.tasks.filter((x) => !x.done && matchCourse(x.title, courses.items)?.id === c.id).length
      return { course: c, deadlines: work.length - exams, exams, tasks: relatedTasks, total: work.length + relatedTasks }
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
  if (!rows.length) return null
  const max = Math.max(...rows.map((r) => r.total))

  return (
    <Section title={t('wl.title')} meta={tn('wl.days', DAYS)}>
      <Card>
        <ul className="separated">
          {rows.map(({ course, deadlines, exams, tasks: n, total }) => (
            <li key={course.id}>
              <button onClick={() => openEditor({ type: 'course', id: course.id })} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-start transition-colors hover:bg-fill">
                <span className="w-36 min-w-0 shrink-0 truncate text-body text-ink sm:w-48">{course.name}</span>
                <span className="relative h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-fill">
                  <span
                    className="absolute inset-y-0 start-0 rounded-full"
                    style={{ width: `${(total / max) * 100}%`, background: course.color ? courseColors[course.color] : 'var(--ink)', opacity: course.color ? 1 : 0.7 }}
                  />
                </span>
                <span className="shrink-0 text-end text-caption text-muted tabular-nums sm:w-40">
                  {joinList([exams ? tn('wl.exams', exams) : '', deadlines ? tn('wl.due', deadlines) : '', n ? tn('wl.tasks', n) : ''].filter(Boolean))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  )
}
