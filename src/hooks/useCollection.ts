import { useCallback } from 'react'
import { uid } from '@/lib/id'
import { stampChange } from '@/sync/store'
import { useLocalStorage } from './useLocalStorage'

export interface Collection<T extends { id: string }> {
  items: T[]
  add: (item: Omit<T, 'id'>) => T
  update: (id: string, patch: Partial<T>) => void
  remove: (id: string) => void
  set: (fn: (items: T[]) => T[]) => void
}

/** A list of records kept on this device; every change is stamped so it can sync. */
export function useCollection<T extends { id: string }>(key: string): Collection<T> {
  const [stored, setStored] = useLocalStorage<T[]>(key)

  const set = useCallback(
    (fn: (items: T[]) => T[]) => setStored((prev) => stampChange(key, prev ?? [], fn(prev ?? []))),
    [key, setStored],
  )

  const add = useCallback(
    (item: Omit<T, 'id'>) => {
      const created = { ...item, id: uid() } as T
      set((items) => [...items, created])
      return created
    },
    [set],
  )

  const update = useCallback(
    (id: string, patch: Partial<T>) => set((items) => items.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    [set],
  )

  const remove = useCallback((id: string) => set((items) => items.filter((x) => x.id !== id)), [set])

  return { items: stored ?? [], add, update, remove, set }
}
