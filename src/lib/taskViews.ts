/** Which tasks each Tasks view shows, search, and sort orders. Pure, so it's easy to reason about. */
import { addDays, startOfDay } from './date'
import { overdueFirst } from './taskDue'
import type { Task, TaskCategory } from '@/types'

export type TaskView = 'inbox' | 'open' | 'today' | 'upcoming' | 'done'
export type TaskSort = 'manual' | 'due' | 'priority'

const dueAt = (t: Task) => (t.due ? new Date(t.due).getTime() : Infinity)
const prio = (t: Task) => t.priority ?? 4

/** Due by the end of today (overdue included). */
export const dueToday = (t: Task, now: Date) => !!t.due && new Date(t.due) < addDays(startOfDay(now), 1)

export function matchesSearch(t: Task, q: string): boolean {
  if (!q) return true
  // "#lab" finds tasks tagged lab.
  if (/^#\S+$/.test(q)) return (t.tags ?? []).includes(q.slice(1).toLocaleLowerCase())
  const needle = q.toLocaleLowerCase()
  return [t.title, t.notes ?? '', ...(t.subtasks ?? []).map((s) => s.title), ...(t.tags ?? []).map((g) => `#${g}`)].some((s) => s.toLocaleLowerCase().includes(needle))
}

export function selectTasks(
  all: Task[],
  { view, category, query, sort, now }: { view: TaskView; category: 'all' | TaskCategory; query: string; sort: TaskSort; now: Date },
): Task[] {
  let list = all.filter((t) => (category === 'all' || t.category === category) && matchesSearch(t, query.trim()))
  if (view === 'done') {
    return list.filter((t) => t.done).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  }
  list = list.filter((t) => !t.done)
  // Inbox: not sorted yet (no date, no priority).
  if (view === 'inbox') list = list.filter((t) => !t.due && !t.priority)
  if (view === 'today') list = list.filter((t) => dueToday(t, now) || t.priority === 1)
  if (view === 'upcoming') list = list.filter((t) => t.due && !dueToday(t, now)).sort((a, b) => dueAt(a) - dueAt(b))
  if (sort === 'due') list = [...list].sort((a, b) => dueAt(a) - dueAt(b) || prio(a) - prio(b))
  else if (sort === 'priority') list = [...list].sort((a, b) => prio(a) - prio(b) || dueAt(a) - dueAt(b))
  return view === 'upcoming' || sort !== 'manual' ? list : overdueFirst(list, now)
}

export function viewCounts(all: Task[], now: Date): Record<TaskView, number> {
  const open = all.filter((t) => !t.done)
  return {
    inbox: open.filter((t) => !t.due && !t.priority).length,
    open: open.length,
    today: open.filter((t) => dueToday(t, now) || t.priority === 1).length,
    upcoming: open.filter((t) => t.due && !dueToday(t, now)).length,
    done: all.length - open.length,
  }
}

/** Today page's short list: overdue, due today, then high priority; soonest and most important first. */
export function focusTasks(all: Task[], now: Date): Task[] {
  const rank = (t: Task) => (t.due && new Date(t.due) < now && !t.dueAllDay ? 0 : t.due && dueToday(t, now) ? 1 : 2)
  return all
    .filter((t) => !t.done && (dueToday(t, now) || t.priority === 1))
    .sort((a, b) => rank(a) - rank(b) || (a.due ?? '~').localeCompare(b.due ?? '~') || prio(a) - prio(b))
}
