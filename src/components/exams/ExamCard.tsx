import { ChevronDown, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Checkbox } from '@/components/tasks/Checkbox'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useDashboard } from '@/context/DashboardContext'
import type { ExamWithPlan } from '@/hooks/useExams'
import { cn } from '@/lib/cn'
import { dayDiff, fmt, isSameDay } from '@/lib/date'
import { planStudy, type SessionView } from '@/lib/exams'

/** "Today", "Tomorrow", "6 days". */
function untilLabel(date: Date, now: Date): string {
  const d = dayDiff(now, date)
  return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`
}

const when = (d: Date, now: Date) =>
  `${isSameDay(d, now) ? 'Today' : dayDiff(now, d) === 1 ? 'Tomorrow' : fmt.shortDate.format(d)}, ${fmt.time.format(d)}`

function SessionRow({ s, now, onToggle }: { s: SessionView; now: Date; onToggle: () => void }) {
  const past = s.end < now
  const current = s.start <= now && !past
  return (
    <li className={cn('flex items-center gap-3 px-4 py-2.5', current && 'bg-accent/8')}>
      <Checkbox checked={s.done} onToggle={onToggle} label={`${s.topic} done`} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-body', s.done ? 'text-muted line-through decoration-faint' : 'text-ink')}>{s.topic}</span>
        <span className={cn('block text-caption tabular-nums', current ? 'font-medium text-accent' : 'text-muted')}>
          {current ? 'Now' : when(s.start, now)}
          {past && !s.done && ' · not ticked'}
        </span>
      </span>
    </li>
  )
}

/** One exam: countdown, progress, and its study sessions to tick off (or a button to plan them). */
export function ExamCard({ exam, now, open: startOpen }: { exam: ExamWithPlan; now: Date; open?: boolean }) {
  const { study, agenda, notify, openEditor } = useDashboard()
  const editTarget =
    exam.source === 'event' ? ({ type: 'exam', id: exam.id } as const) : exam.source === 'assignment' ? ({ type: 'deadline', id: exam.id } as const) : null
  const [open, setOpen] = useState(Boolean(startOpen))
  const [topics, setTopics] = useState('')
  const total = exam.sessions.length
  const pastUnticked = exam.sessions.filter((s) => !s.done && s.end < now)
  const planned = exam.sessions.length > 0 && !exam.sessions[0].fromCalendar

  const setDone = (list: SessionView[], done: boolean) =>
    study.set((items) => {
      const byId = new Map(items.map((i) => [i.id, i]))
      for (const s of list) {
        const prev = byId.get(s.id)
        byId.set(
          s.id,
          prev
            ? { ...prev, done }
            : { id: s.id, examId: exam.id, start: s.start.toISOString(), minutes: Math.round((s.end.getTime() - s.start.getTime()) / 60_000), topic: s.topic, done, fromCalendar: true },
        )
      }
      return [...byId.values()]
    })

  const makePlan = () => {
    const list = topics
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    const plan = planStudy(exam, agenda, now, list)
    if (!plan.length) return notify('No free time left before this exam to plan sessions.', 'error')
    study.set((items) => [...items.filter((i) => !(i.examId === exam.id && !i.fromCalendar)), ...plan])
    notify(`${plan.length} study ${plan.length === 1 ? 'session' : 'sessions'} planned`)
  }

  const clearPlan = () => {
    study.set((items) => items.filter((i) => !(i.examId === exam.id && !i.fromCalendar)))
    notify('Study plan removed')
  }

  const soon = dayDiff(now, exam.date) <= 2

  return (
    <article className="surface overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-4 px-5 pt-5 pb-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="text-subhead font-medium text-muted">Exam{exam.context ? ` · ${exam.context}` : ''}</span>
          <span className="mt-0.5 block text-title text-ink">{exam.subject}</span>
          <span className="mt-0.5 block text-subhead text-muted">
            {exam.allDay ? fmt.longDate.format(exam.date) : `${fmt.longDate.format(exam.date)}, ${fmt.time.format(exam.date)}`}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className={cn('text-[2rem] leading-none font-semibold tabular-nums', soon ? 'text-danger' : 'text-ink')}>
            {dayDiff(now, exam.date) <= 1 ? '' : dayDiff(now, exam.date)}
          </span>
          <span className={cn('text-subhead font-medium', soon ? 'text-danger' : 'text-muted')}>
            {dayDiff(now, exam.date) <= 1 ? untilLabel(exam.date, now) : 'days left'}
          </span>
        </span>
      </button>

      {exam.url && (
        <div className="px-5 pb-4">
          <LinkButton url={exam.url} />
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center gap-3 px-5 pb-4">
          <ProgressBar value={exam.done / total} label={`${exam.subject} study progress`} className="flex-1" />
          <span className="text-subhead font-medium text-ink tabular-nums">
            {exam.done}/{total}
          </span>
        </div>
      )}

      {!open && exam.next && (
        <button onClick={() => setOpen(true)} className="flex w-full items-center gap-2 border-t border-line px-5 py-3 text-left text-subhead">
          <span className="text-muted">Next:</span>
          <span className="min-w-0 flex-1 truncate text-ink">{exam.next.topic}</span>
          <span className="shrink-0 text-muted tabular-nums">{when(exam.next.start, now)}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-faint" />
        </button>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className="overflow-hidden border-t border-line"
          >
            {total > 0 ? (
              <>
                <p className="px-5 pt-3 pb-1 text-caption text-faint">
                  {planned ? 'Planned by dash on your free time.' : 'Study sessions from your calendar.'}
                </p>
                <ul className="separated">
                  {exam.sessions.map((s) => (
                    <SessionRow key={s.id} s={s} now={now} onToggle={() => setDone([s], !s.done)} />
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
                  {pastUnticked.length > 0 && (
                    <Button size="sm" onClick={() => setDone(pastUnticked, true)}>
                      Mark {pastUnticked.length} past {pastUnticked.length === 1 ? 'session' : 'sessions'} done
                    </Button>
                  )}
                  {planned && (
                    <Button size="sm" variant="plain" onClick={clearPlan}>
                      Remove plan
                    </Button>
                  )}
                  {editTarget && (
                    <Button size="sm" variant="plain" onClick={() => openEditor(editTarget)}>
                      Edit exam
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3 px-5 py-4">
                <p className="text-subhead text-muted">
                  No study sessions yet. dash can plan up to six on your free time before the exam, keeping work, classes and your trips clear.
                </p>
                <textarea
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  rows={2}
                  placeholder="Topics, one per line or separated by commas (optional)"
                  className="w-full resize-none rounded-[var(--radius-control)] bg-fill px-3.5 py-2.5 text-base text-ink placeholder:text-faint outline-none focus:bg-surface sm:text-[0.9375rem]"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" onClick={makePlan}>
                    <Sparkles aria-hidden className="size-4" strokeWidth={2.2} />
                    Make a study plan
                  </Button>
                  {editTarget && (
                    <Button size="sm" variant="plain" onClick={() => openEditor(editTarget)}>
                      Edit exam
                    </Button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}
