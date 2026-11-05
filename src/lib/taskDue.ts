import { dayDiff, fmt } from './date'
import type { Task } from '@/types'

export type DueState = 'overdue' | 'today' | 'soon' | 'later'

/** How urgent a task's due date is, and how to say it: "Overdue · Mon 2 Nov", "Today 18:00", "Tomorrow". */
export function dueInfo(task: Task, now: Date): { state: DueState; label: string } | undefined {
  if (!task.due) return undefined
  const due = new Date(task.due)
  const days = dayDiff(now, due)
  const time = task.dueAllDay ? '' : ` ${fmt.time.format(due)}`
  const overdue = task.dueAllDay ? days < 0 : due < now
  if (overdue) return { state: 'overdue', label: `Overdue · ${days === 0 ? 'today' : days === -1 ? 'yesterday' : fmt.shortDate.format(due)}${time}` }
  if (days === 0) return { state: 'today', label: `Today${time}` }
  if (days === 1) return { state: 'soon', label: `Tomorrow${time}` }
  return { state: days <= 6 ? 'soon' : 'later', label: `${fmt.shortDate.format(due)}${time}` }
}

/** Overdue tasks first (oldest first), then the rest in your own order. */
export function overdueFirst(tasks: Task[], now: Date): Task[] {
  const late = tasks.filter((t) => !t.done && dueInfo(t, now)?.state === 'overdue').sort((a, b) => a.due!.localeCompare(b.due!))
  const ids = new Set(late.map((t) => t.id))
  return [...late, ...tasks.filter((t) => !ids.has(t.id))]
}
