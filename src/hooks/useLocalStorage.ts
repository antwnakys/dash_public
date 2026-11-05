import { useCallback, useEffect, useState, type SetStateAction } from 'react'
import { announceLocalChange, REMOTE_EVENT } from '@/sync/store'

function read<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? undefined : (JSON.parse(raw) as T)
  } catch {
    return undefined
  }
}

/**
 * State mirrored to localStorage; `undefined` means nothing was stored yet.
 * Picks up writes made by sync (and by other tabs), and announces the user's own changes.
 */
export function useLocalStorage<T>(key: string) {
  const [value, setValue] = useState<T | undefined>(() => read<T>(key))

  useEffect(() => {
    if (value === undefined) return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage full or blocked: keep working in memory.
    }
  }, [key, value])

  useEffect(() => {
    const reload = () => setValue(read<T>(key))
    const onRemote = (e: Event) => (e as CustomEvent<string[]>).detail.includes(key) && reload()
    const onOtherTab = (e: StorageEvent) => e.key === key && reload()
    window.addEventListener(REMOTE_EVENT, onRemote)
    window.addEventListener('storage', onOtherTab)
    return () => {
      window.removeEventListener(REMOTE_EVENT, onRemote)
      window.removeEventListener('storage', onOtherTab)
    }
  }, [key])

  const set = useCallback(
    (next: SetStateAction<T | undefined>) => {
      setValue(next)
      // After React commits and the effect above persists it.
      queueMicrotask(() => setTimeout(() => announceLocalChange(key), 0))
    },
    [key],
  )

  return [value, set] as const
}
