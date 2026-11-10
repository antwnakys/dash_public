import { ArrowUpRight, CheckCircle2, Plus, StickyNote } from 'lucide-react'
import { courseColors } from '@/lib/courseColor'
import { matchCourse } from '@/lib/school'
import { Countdown } from '@/components/ui/Countdown'
import { JoinButton } from '@/components/ui/JoinButton'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useDashboard } from '@/context/DashboardContext'
import { dayDiff, fmt } from '@/lib/date'
import { average, formatGrade, SCALE } from '@/lib/grades'
import { nextMeeting } from '@/lib/schedule'
import type { Assignment, Course } from '@/types'
import { t, tn } from '@/i18n'

const linkName = { portal: t('course.portal'), materials: t('course.materials'), video: t('course.lectures'), meeting: t('course.online'), other: '' } as const

const ATTENTION_DAYS = 3

interface CourseCardProps {
  course: Course
  /** Unsubmitted work for this course, soonest first. */
  pending: Assignment[]
  now: Date
}

function whenLabel(d: Date, now: Date) {
  const diff = dayDiff(now, d)
  const day = diff === 0 ? t('agenda.today') : diff === 1 ? t('agenda.tomorrow') : fmt.shortDate.format(d)
  return `${day}, ${fmt.time.format(d)}`
}

export function CourseCard({ course, pending, now }: CourseCardProps) {
  const { openEditor, agenda, assignments, tasks, courses, setView } = useDashboard()
  const grades = average(assignments.items.filter((a) => a.courseId === course.id))
  // The calendar knows about cancellations and room changes, so it wins over the weekly times.
  const nextItem = agenda.find((i) => i.kind === 'class' && i.courseId === course.id && (i.end ?? i.date) > now)
  const next = nextItem?.date ?? nextMeeting(course, now)
  // Join button: the next online class's own link first, else the meeting link saved on the course (always shown,
  // so a course with a Teams link has its button even without a calendar).
  const savedMeeting = course.links.find((l) => l.kind === 'meeting')?.url
  const joinUrl = (nextItem?.online ? nextItem.link : undefined) ?? savedMeeting
  const pct = Math.round(course.progress * 100)
  const when = [course.schedule, course.instructor && t('course.with', { name: course.instructor })].filter(Boolean).join(' ')
  // Needs attention: work overdue, or due within three days.
  const overdue = assignments.items.filter((a) => a.courseId === course.id && !a.submitted && new Date(a.due) <= now).length
  const soon = pending.filter((a) => dayDiff(now, new Date(a.due)) <= ATTENTION_DAYS).length
  const attention = overdue > 0 ? tn('cc.overdue', overdue) : soon > 0 ? tn('cc.soon', soon) : undefined
  // Open tasks that name this course ("Macro reading", "ECO210 notes").
  const related = tasks.tasks.filter((x) => !x.done && matchCourse(x.title, courses.items)?.id === course.id).length

  return (
    <article className="surface flex w-full flex-col transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-soft)] [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[var(--shadow-float)]">
      <button
        onClick={() => openEditor({ type: 'course', id: course.id })}
        aria-label={t('course.edit', { name: course.name })}
        className="rounded-t-[var(--radius-card)] px-5 pt-5 pb-4 text-start transition-colors hover:bg-fill/60"
      >
        <span className="flex items-center gap-2">
          {course.color && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: courseColors[course.color] }} />}
          {course.code && <span className="text-subhead font-medium text-muted">{course.code}</span>}
          {attention && (
            <span className={`ms-auto rounded-[0.35rem] px-1.5 py-px text-caption font-semibold ${overdue ? 'bg-danger/12 text-danger' : 'bg-accent/12 text-accent'}`}>
              {attention}
            </span>
          )}
        </span>
        <h3 className="mt-0.5 text-headline text-ink">{course.name}</h3>
        {when && <p className="mt-0.5 text-subhead text-muted">{when}</p>}
        {next && (
          <p className="mt-1.5 text-subhead font-medium text-course">
            {nextItem?.online ? t('course.nextClassOnline') : t('course.nextClass')}: {whenLabel(next, now)}
          </p>
        )}
        {grades && (
          <p className="mt-1 text-subhead text-muted">
            {t('course.average')} <span className="font-semibold text-ink tabular-nums">{formatGrade(grades.value)}</span>/{SCALE} · {tn('course.grades', grades.count)}
          </p>
        )}
        {course.notes && (
          <p className="mt-1.5 flex items-start gap-1.5 text-subhead text-muted">
            <StickyNote aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
            <span className="line-clamp-2">{course.notes}</span>
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={course.progress} label={t('course.progress', { name: course.name })} className="flex-1" />
          <span className="text-subhead font-medium text-ink tabular-nums">{pct}%</span>
        </div>
      </button>

      {joinUrl && (
        <div className="border-t border-line px-5 py-3">
          <JoinButton url={joinUrl} />
        </div>
      )}
      {related > 0 && (
        <button
          onClick={() => setView('tasks')}
          className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-start text-subhead text-muted transition-colors hover:bg-fill hover:text-ink"
        >
          <CheckCircle2 aria-hidden className="size-4" strokeWidth={2} />
          {tn('cc.tasks', related)}
        </button>
      )}
      <div className="border-t border-line">
        {pending.length === 0 ? (
          <p className="px-5 py-3 text-subhead text-muted">{t('courses.nothingDue')}</p>
        ) : (
          <ul className="separated">
            {pending.slice(0, 3).map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => openEditor({ type: 'deadline', id: a.id })}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-start transition-colors hover:bg-fill"
                >
                  <span className="min-w-0 flex-1 truncate text-body text-ink">{a.title}</span>
                  <Countdown date={new Date(a.due)} now={now} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2.5">
        {course.links.filter((l) => l.kind !== 'meeting').map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 max-w-48 items-center gap-1 rounded-full bg-fill px-3 text-subhead font-medium text-ink transition-colors hover:bg-fill-strong"
          >
            <span className="truncate">{linkName[link.kind] || link.label}</span>
            <ArrowUpRight aria-hidden className="size-3.5 text-muted" strokeWidth={2.2} />
          </a>
        ))}
        <button
          onClick={() => openEditor({ type: 'deadline', courseId: course.id })}
          className="ms-auto inline-flex h-8 items-center gap-1 rounded-full px-3 text-subhead font-medium text-accent transition-colors hover:bg-fill"
        >
          <Plus aria-hidden className="size-3.5" strokeWidth={2.4} />
          {t('course.deadline')}
        </button>
      </div>
    </article>
  )
}
