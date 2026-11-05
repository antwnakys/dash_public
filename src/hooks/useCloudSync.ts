import { useCallback, useEffect, useRef, useState } from 'react'
import { googleAccessToken, GoogleReconnectError } from '@/data/google'
import { download, fileMeta, findFile, upload } from '@/sync/drive'
import { mergeDocs, sameDoc } from '@/sync/merge'
import { LOCAL_EVENT, readLocalDoc, writeLocalDoc } from '@/sync/store'

const META_KEY = 'dash.sync.meta.v1'
const POLL = 30_000
const DEBOUNCE = 1_200

interface Meta {
  fileId?: string
  modifiedTime?: string
  lastSyncedAt?: string
}

export interface CloudSync {
  /** `paused`: Google needs a reconnect before syncing can continue. */
  status: 'off' | 'syncing' | 'synced' | 'paused' | 'error'
  lastSyncedAt?: string
  error?: string
  syncNow: () => void
}

function readMeta(): Meta {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? '{}') as Meta
  } catch {
    return {}
  }
}

function saveMeta(meta: Meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // Not critical: the next sync finds the file again.
  }
}

/**
 * Keeps courses, deadlines, events, tasks and profile identical across every device signed in to the
 * same Google account. Pulls on launch, on return to the app and every 30 seconds; pushes shortly after
 * each change. Local data always stays usable offline and merges when the connection is back.
 */
export function useCloudSync(enabled: boolean): CloudSync {
  const [status, setStatus] = useState<CloudSync['status']>(enabled ? 'syncing' : 'off')
  const [lastSyncedAt, setLastSyncedAt] = useState(() => readMeta().lastSyncedAt)
  const [error, setError] = useState<string>()
  const running = useRef(false)
  const again = useRef(false)
  const dirty = useRef(true)
  const rerun = useRef<() => void>(() => {})

  const run = useCallback(async () => {
    if (!enabled) return
    if (running.current) {
      again.current = true
      return
    }
    running.current = true
    try {
      const token = await googleAccessToken()
      const meta = readMeta()
      let file = meta.fileId ? await fileMeta(token, meta.fileId) : null
      file ??= await findFile(token)

      // Nothing changed anywhere since the last sync: skip the download.
      if (file && !dirty.current && file.modifiedTime === meta.modifiedTime) {
        setStatus('synced')
        return
      }

      setStatus('syncing')
      const local = readLocalDoc()
      const remote = file ? await download(token, file.id) : null
      const merged = remote ? mergeDocs(local, remote) : local
      if (!sameDoc(merged, local)) writeLocalDoc(merged, local)
      if (!remote || !sameDoc(merged, remote)) file = await upload(token, merged, file?.id)

      dirty.current = false
      const now = new Date().toISOString()
      saveMeta({ fileId: file?.id, modifiedTime: file?.modifiedTime, lastSyncedAt: now })
      setLastSyncedAt(now)
      setStatus('synced')
      setError(undefined)
    } catch (e) {
      if (e instanceof GoogleReconnectError) {
        setStatus('paused')
        setError(e.message)
      } else {
        setStatus('error')
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      running.current = false
      if (again.current) {
        again.current = false
        rerun.current()
      }
    }
  }, [enabled])

  useEffect(() => {
    rerun.current = () => void run()
  }, [run])

  useEffect(() => {
    if (!enabled) return
    void run()
    let debounce: number | undefined
    const onLocal = () => {
      dirty.current = true
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => void run(), DEBOUNCE)
    }
    const onVisible = () => document.visibilityState === 'visible' && void run()
    const timer = window.setInterval(() => document.visibilityState === 'visible' && void run(), POLL)
    window.addEventListener(LOCAL_EVENT, onLocal)
    window.addEventListener('online', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(debounce)
      window.clearInterval(timer)
      window.removeEventListener(LOCAL_EVENT, onLocal)
      window.removeEventListener('online', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, run])

  const syncNow = useCallback(() => {
    dirty.current = true
    void run()
  }, [run])

  return { status: enabled ? status : 'off', lastSyncedAt, error, syncNow }
}
