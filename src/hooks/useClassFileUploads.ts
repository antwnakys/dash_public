import { useEffect, useRef } from 'react'
import { localFile, uploadFile } from '@/lib/classFiles'
import type { ClassNote } from '@/types'
import type { Collection } from './useCollection'

/**
 * While signed in to Google, uploads class-note files that are on this device but not in Drive yet (added offline,
 * or before connecting), so the other devices can open them. Runs when notes change; one pass at a time.
 */
export function useClassFileUploads(notes: Collection<ClassNote>, signedIn: boolean) {
  const running = useRef(false)
  useEffect(() => {
    if (!signedIn || running.current) return
    const pending = notes.items.flatMap((n) => (n.files ?? []).filter((f) => !f.driveId).map((f) => ({ note: n, file: f })))
    if (!pending.length) return
    running.current = true
    void (async () => {
      for (const { note, file } of pending) {
        try {
          if (!(await localFile(file.id))) continue
          const driveId = await uploadFile(file)
          if (!driveId) continue
          notes.set((list) =>
            list.map((n) => (n.id === note.id ? { ...n, files: n.files?.map((f) => (f.id === file.id ? { ...f, driveId } : f)) } : n)),
          )
        } catch {
          break // Offline or signed out: try again next time.
        }
      }
      running.current = false
    })()
  }, [notes, signedIn])
}
