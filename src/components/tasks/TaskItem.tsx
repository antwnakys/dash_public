import { motion, Reorder, useDragControls } from 'framer-motion'
import { CalendarClock, Flag, GripVertical, ListChecks, Repeat, StickyNote, X } from 'lucide-react'
import { useDashboard } from '@/context/DashboardContext'
import { cn } from '@/lib/cn'
import { ease, spring } from '@/lib/motion'
import type { DueState } from '@/lib/taskDue'
import { t } from '@/i18n'
import type { Task } from '@/types'
import { categoryLabel } from './categories'
import { Checkbox } from './Checkbox'

interface TaskItemProps {
  task: Task
  showCategory: boolean
  due?: { state: DueState; label: string }
  /** Show the drag handle (only where the list is in your own order). */
  reorderable?: boolean
  onToggle: () => void
  onRemove: () => void
}

const dueTone: Record<DueState, string> = {
  overdue: 'font-medium text-danger',
  today: 'font-medium text-accent',
  soon: 'text-muted',
  later: 'text-muted',
}

const priorityTone = { 1: 'text-danger', 2: 'text-accent', 3: 'text-faint' } as const
const priorityName = { 1: t('prio.high'), 2: t('prio.medium'), 3: t('prio.low') } as const

export function TaskItem({ task, showCategory, due, reorderable = true, onToggle, onRemove }: TaskItemProps) {
  const steps = task.subtasks?.length ? `${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length}` : undefined
  const meta = (showCategory || (due && !task.done) || steps || task.repeat || task.notes || task.tags?.length) && !task.done
  const controls = useDragControls()
  const { openEditor } = useDashboard()

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      layout="position"
      // New tasks open a gap and slide into it; deleted ones slip sideways and the gap closes.
      initial={{ opacity: 0, height: 0, x: -12 }}
      animate={{ opacity: 1, height: 'auto', x: 0 }}
      exit={{ opacity: 0, height: 0, x: 40, transition: { height: { ...spring.smooth, delay: 0.06 }, x: { duration: 0.18, ease: ease.out }, opacity: { duration: 0.15 } } }}
      transition={{ height: spring.smooth, x: spring.gentle, opacity: { duration: 0.25 }, layout: spring.smooth }}
      whileDrag={{ scale: 1.03, boxShadow: 'var(--shadow-float)', zIndex: 10, borderRadius: 14 }}
      className="group relative list-none bg-surface"
    >
      <div className="flex min-h-[3.25rem] items-center gap-3 py-2 pe-2 ps-1">
        <button
          type="button"
          tabIndex={reorderable ? undefined : -1}
          aria-hidden={!reorderable || undefined}
          style={reorderable ? undefined : { visibility: 'hidden' }}
          aria-label={t('tasks.reorder', { title: task.title })}
          onPointerDown={(e) => controls.start(e)}
          className="flex h-9 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-faint opacity-50 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing lg:opacity-0"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>

        <Checkbox checked={task.done} onToggle={onToggle} label={task.title} />

        <button
          type="button"
          onClick={() => openEditor({ type: 'task', id: task.id })}
          aria-label={t('tasks.edit', { title: task.title })}
          className="ms-2 flex min-w-0 flex-1 flex-col text-start"
        >
          <span className="relative flex w-fit max-w-full items-center gap-1.5">
            {task.priority && !task.done && (
              <Flag aria-label={t('qa.priority', { p: priorityName[task.priority] })} className={cn('size-3.5 shrink-0 fill-current', priorityTone[task.priority])} strokeWidth={2.2} />
            )}
            <span className={`block truncate text-body transition-colors duration-300 ${task.done ? 'text-faint' : 'text-ink'}`}>
              {task.title}
            </span>
            <motion.span
              aria-hidden
              className="absolute top-1/2 start-0 h-px w-full origin-left rtl:origin-right bg-faint"
              initial={false}
              animate={{ scaleX: task.done ? 1 : 0 }}
              transition={{ duration: 0.32, delay: task.done ? 0.12 : 0, ease: ease.out }}
            />
          </span>
          {meta && (
            <span className="flex min-w-0 items-center gap-2.5 text-subhead text-muted">
              {due && (
                <span className={cn('inline-flex shrink-0 items-center gap-1 tabular-nums', dueTone[due.state])}>
                  <CalendarClock aria-hidden className="size-3.5" strokeWidth={2.2} />
                  {due.label}
                </span>
              )}
              {task.repeat && <Repeat aria-label={t('qa.repeats')} className="size-3.5 shrink-0" strokeWidth={2.2} />}
              {steps && (
                <span className="inline-flex shrink-0 items-center gap-1 tabular-nums" aria-label={t('qa.stepsDone', { steps })}>
                  <ListChecks aria-hidden className="size-3.5" strokeWidth={2.2} />
                  {steps}
                </span>
              )}
              {task.notes && <StickyNote aria-label={t('qa.hasNotes')} className="size-3.5 shrink-0" strokeWidth={2.2} />}
              {showCategory && <span className="truncate">{categoryLabel[task.category]}</span>}
              {task.tags?.slice(0, 3).map((t) => (
                <span key={t} className="shrink-0 text-accent">#{t}</span>
              ))}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onRemove}
          aria-label={t('tasks.delete', { title: task.title })}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-faint transition hover:bg-fill hover:text-ink focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </Reorder.Item>
  )
}
