import { useCallback } from 'react'
import { uid } from '@/lib/id'
import { nextRepeat } from '@/lib/quickAdd'
import type { Task, TaskCategory } from '@/types'
import { useCollection } from './useCollection'

export interface TasksApi {
  tasks: Task[]
  /** Adds a task to the top and returns it. `extra` sets due date, priority, repeat, notes, subtasks… */
  add: (title: string, category: TaskCategory, extra?: Partial<Omit<Task, 'id' | 'title' | 'category'>>) => Task
  update: (id: string, patch: Partial<Omit<Task, 'id'>>) => void
  /** Tick or untick. A repeating task is filed as done and the next one is added (returned). */
  toggle: (id: string) => Task | undefined
  remove: (id: string) => void
  /** Put a deleted task back where it was (undo). */
  restore: (task: Task, index?: number) => void
  /** Apply a new order for a subset (e.g. one filtered category) of tasks. */
  reorder: (subset: Task[]) => void
  replaceAll: (tasks: Task[]) => void
}

/** The next copy of a repeating task: due on the next repeat that isn't in the past, subtasks unticked. */
export function nextOccurrence(task: Task, now = new Date()): Task | undefined {
  if (!task.repeat || !task.due) return undefined
  let due = nextRepeat(new Date(task.due), task.repeat)
  for (let i = 0; i < 1000 && due < now; i++) due = nextRepeat(due, task.repeat)
  return {
    ...task,
    id: uid(),
    done: false,
    completedAt: undefined,
    createdAt: now.toISOString(),
    due: due.toISOString(),
    subtasks: task.subtasks?.map((s) => ({ ...s, done: false })),
  }
}

export function useTasks(): TasksApi {
  const { items, set, remove } = useCollection<Task>('unidash.tasks.v1')

  const add = useCallback(
    (title: string, category: TaskCategory, extra?: Partial<Omit<Task, 'id' | 'title' | 'category'>>) => {
      const task: Task = { id: uid(), title, category, done: false, createdAt: new Date().toISOString(), ...extra }
      // Optional fields left undefined aren't stored.
      for (const k of Object.keys(task) as Array<keyof Task>) if (task[k] === undefined) delete task[k]
      set((ts) => [task, ...ts])
      return task
    },
    [set],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<Task, 'id'>>) => set((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [set],
  )

  const toggle = useCallback(
    (id: string) => {
      const task = items.find((t) => t.id === id)
      if (!task) return undefined
      const now = new Date()
      const next = !task.done ? nextOccurrence(task, now) : undefined
      set((ts) => {
        const list = ts.map((t) =>
          t.id === id ? { ...t, done: !t.done, completedAt: t.done ? undefined : now.toISOString() } : t,
        )
        if (!next) return list
        const at = list.findIndex((t) => t.id === id)
        return [...list.slice(0, at), next, ...list.slice(at)]
      })
      return next
    },
    [items, set],
  )

  const restore = useCallback(
    (task: Task, index = 0) =>
      set((ts) => (ts.some((t) => t.id === task.id) ? ts : [...ts.slice(0, index), task, ...ts.slice(index)])),
    [set],
  )

  const reorder = useCallback(
    (subset: Task[]) =>
      set((ts) => {
        // Slots the subset occupies in the full list are refilled in the new order.
        const ids = new Set(subset.map((t) => t.id))
        const queue = [...subset]
        return ts.map((t) => (ids.has(t.id) ? queue.shift()! : t))
      }),
    [set],
  )

  const replaceAll = useCallback((tasks: Task[]) => set(() => tasks), [set])

  return { tasks: items, add, update, toggle, remove, restore, reorder, replaceAll }
}
