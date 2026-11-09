import { useCallback, useEffect, useRef, useState } from 'react'
import {
  connectGoogle,
  disconnectGoogle,
  fetchGoogleEvents,
  googleConfigured,
  GoogleReconnectError,
  initGoogle,
  type GoogleAccount,
} from '@/data/google'
import { parseIcs } from '@/lib/ics'
import { isNative } from '@/lib/native'
import type { CalendarEvent } from '@/types'
import { useLocalStorage } from './useLocalStorage'
import { t } from '@/i18n'

const DAY_MS = 86_400_000
const EVERY = 15 * 60_000

export interface CalendarSync {
  events: CalendarEvent[]
  /** `reconnect`: Google needs the user to sign in again before syncing can continue. */
  status: 'off' | 'syncing' | 'ok' | 'error' | 'reconnect'
  syncedAt?: string
  error?: string
  sync: () => void
  google: {
    available: boolean
    account?: GoogleAccount
    connecting: boolean
    connect: () => Promise<void>
    disconnect: () => Promise<void>
  }
}

interface Snapshot {
  events: CalendarEvent[]
  syncedAt: string
}

const normalize = (url: string) => url.trim().replace(/^webcal:\/\//i, 'https://')

async function fetchFeed(url: string, index: number): Promise<CalendarEvent[]> {
  // In the iOS app fetch goes through native HTTP (CapacitorHttp), so Google's missing CORS headers don't matter.
  const res = await fetch(normalize(url), { cache: 'no-store' })
  if (!res.ok) throw new Error(t('cal.feedStatus', { status: res.status }))
  const text = await res.text()
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error(t('cal.notCalendar'))
  return parseIcs(text, { from: Date.now() - DAY_MS, to: Date.now() + 180 * DAY_MS, idPrefix: `cal${index}` })
}

const feedError = (e: unknown) =>
  e instanceof TypeError && !isNative
    ? t('cal.browserBlocked')
    : e instanceof Error
      ? e.message
      : String(e)

/**
 * Keeps a read-only copy of the user's calendars (Google account and/or iCal links),
 * refreshed on launch, every 15 minutes and on return to the app.
 */
export function useCalendarSync(urls: string[] = []): CalendarSync {
  const [snapshot, setSnapshot] = useLocalStorage<Snapshot>('unidash.calendar.v1')
  const [account, setAccount] = useLocalStorage<GoogleAccount | null>('unidash.google.v1')
  const [status, setStatus] = useState<CalendarSync['status']>('ok')
  const [error, setError] = useState<string>()
  const [connecting, setConnecting] = useState(false)
  const key = urls.join('\n')
  const googleOn = googleConfigured && Boolean(account)
  const active = Boolean(key) || googleOn
  const running = useRef(false)
  const latestSync = useRef<() => void>(() => {})

  // Initialise early so a web sign-in popup that loaded the app can hand its result back.
  useEffect(() => {
    initGoogle().catch(() => {})
  }, [])

  const sync = useCallback(async () => {
    const list = key.split('\n').filter(Boolean)
    if ((!list.length && !googleOn) || running.current) return
    running.current = true
    setStatus('syncing')
    const jobs = [...list.map(fetchFeed), ...(googleOn ? [fetchGoogleEvents()] : [])]
    const results = await Promise.allSettled(jobs)
    running.current = false

    const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    const failures = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []))

    if (ok.length) {
      const seen = new Set<string>()
      const events = ok.flat().filter((e) => !seen.has(e.id) && seen.add(e.id))
      setSnapshot({ events, syncedAt: new Date().toISOString() })
    }
    if (failures.some((f) => f instanceof GoogleReconnectError)) {
      setStatus('reconnect')
      setError(t('google.expired'))
    } else if (failures.length) {
      setStatus('error')
      setError(feedError(failures[0]))
    } else {
      setStatus('ok')
      setError(undefined)
    }
  }, [key, googleOn, setSnapshot])

  useEffect(() => {
    latestSync.current = sync
  }, [sync])

  useEffect(() => {
    if (!active) return
    sync()
    const timer = window.setInterval(sync, EVERY)
    const onVisible = () => document.visibilityState === 'visible' && sync()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, sync])

  const connect = useCallback(async () => {
    setConnecting(true)
    try {
      setAccount(await connectGoogle())
      // A first connection re-runs the sync effect; a reconnection needs an explicit sync.
      setTimeout(() => latestSync.current(), 0)
    } finally {
      setConnecting(false)
    }
  }, [setAccount])

  const disconnect = useCallback(async () => {
    await disconnectGoogle()
    setAccount(null)
    if (!key) setSnapshot({ events: [], syncedAt: new Date().toISOString() })
  }, [key, setAccount, setSnapshot])

  const google = { available: googleConfigured, account: account ?? undefined, connecting, connect, disconnect }

  if (!active) return { events: [], status: 'off', sync, google }
  return { events: snapshot?.events ?? [], status, syncedAt: snapshot?.syncedAt, error, sync, google }
}
