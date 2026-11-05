import { useCallback } from 'react'
import { uid } from '@/lib/id'
import type { Task, TaskCategory } from '@/types'
import { useCollection } from './useCollection'

export interface TasksApi {
  tasks: Task[]
  add: (title: string, category: TaskCategory, due?: Pick<Task, 'due' | 'dueAllDay'>) => void
  update: (id: string, patch: Partial<Omit<Task, 'id'>>) => void
  toggle: (id: string) => void
  remove: (id: string) => void
  /** Apply a new order for a subset (e.g. one filtered category) of tasks. */
  reorder: (subset: Task[]) => void
  replaceAll: (tasks: Task[]) => void
}

export function useTasks(): TasksApi {
  const { items, set, remove } = useCollection<Task>('dash.tasks.v1')

  const add = useCallback(
    (title: string, category: TaskCategory, due?: Pick<Task, 'due' | 'dueAllDay'>) =>
      set((ts) => [{ id: uid(), title, category, done: false, createdAt: new Date().toISOString(), ...due }, ...ts]),
    [set],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<Task, 'id'>>) => set((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [set],
  )

  const toggle = useCallback(
    (id: string) => set((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
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

  return { tasks: items, add, update, toggle, remove, reorder, replaceAll }
}
