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
import { askDeviceAccess, deviceAccess, fetchDeviceEvents, onDeviceCalendarChange, openCalendarSettings, type DeviceAccess } from '@/data/deviceCalendar'
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
  /** This iPhone's own calendars (apps only; `unavailable` on the web and in builds without the plugin). */
  device: {
    access: DeviceAccess
    on: boolean
    /** Asks iOS once, then reads; `denied` means it has to be turned on in iPhone Settings. */
    enable: () => Promise<DeviceAccess>
    disable: () => void
    openSettings: () => void
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
  return parseIcs(text, { from: Date.now() - 31 * DAY_MS, to: Date.now() + 180 * DAY_MS, idPrefix: `cal${index}` })
}

const feedError = (e: unknown) =>
  e instanceof TypeError && !isNative
    ? t('cal.browserBlocked')
    : e instanceof Error
      ? e.message
      : String(e)

/**
 * Keeps a read-only copy of the user's calendars (Google account, iCal links and/or this iPhone's calendars),
 * refreshed on launch, every 15 minutes and on return to the app. The same event in Google and in the iPhone's
 * calendars (a Google account added in iOS Settings) is kept once, from Google.
 */
export function useCalendarSync(urls: string[] = []): CalendarSync {
  const [snapshot, setSnapshot] = useLocalStorage<Snapshot>('unidash.calendar.v1')
  const [account, setAccount] = useLocalStorage<GoogleAccount | null>('unidash.google.v1')
  const [status, setStatus] = useState<CalendarSync['status']>('ok')
  const [error, setError] = useState<string>()
  const [connecting, setConnecting] = useState(false)
  // Per device: a phone's calendars belong to that phone.
  const [deviceWanted, setDeviceWanted] = useLocalStorage<boolean>('unidash.deviceCalendar.v1')
  const [access, setAccess] = useState<DeviceAccess>('unavailable')
  const key = urls.join('\n')
  const googleOn = googleConfigured && Boolean(account)
  const deviceOn = Boolean(deviceWanted) && access === 'granted'
  const active = Boolean(key) || googleOn || deviceOn
  const running = useRef(false)
  const latestSync = useRef<() => void>(() => {})

  // Initialise early so a web sign-in popup that loaded the app can hand its result back.
  useEffect(() => {
    initGoogle().catch(() => {})
  }, [])

  // Calendar access can change in iPhone Settings while unidash is in the background.
  useEffect(() => {
    if (!isNative) return
    const check = () => void deviceAccess().then(setAccess)
    check()
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const sync = useCallback(async () => {
    const list = key.split('\n').filter(Boolean)
    if ((!list.length && !googleOn && !deviceOn) || running.current) return
    running.current = true
    setStatus('syncing')
    const jobs = [...list.map(fetchFeed), ...(googleOn ? [fetchGoogleEvents()] : [])]
    const [results, phone] = await Promise.all([Promise.allSettled(jobs), deviceOn ? fetchDeviceEvents().catch(() => null) : Promise.resolve([])])
    running.current = false

    const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    const failures = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []))

    // A failed Google/iCal read keeps the last copy rather than replacing it with the phone's events alone.
    if (ok.length || (!failures.length && phone)) {
      const seen = new Set<string>()
      const online = ok.flat().filter((e) => !seen.has(e.id) && seen.add(e.id))
      // The phone often has the same Google calendars: same title and start = the same event.
      const same = (e: CalendarEvent) => `${e.title.trim().toLowerCase()}|${e.start}`
      const known = new Set(online.map(same))
      const events = [...online, ...(phone ?? []).filter((e) => !known.has(same(e)))]
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
  }, [key, googleOn, deviceOn, setSnapshot])

  useEffect(() => {
    latestSync.current = sync
  }, [sync])

  // Edits in Apple Calendar while unidash is open.
  useEffect(() => {
    if (!deviceOn) return
    let handle: { remove: () => Promise<void> } | undefined
    void onDeviceCalendarChange(() => latestSync.current()).then((h) => (handle = h))
    return () => void handle?.remove()
  }, [deviceOn])

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
    if (!key && !deviceOn) setSnapshot({ events: [], syncedAt: new Date().toISOString() })
    else setTimeout(() => latestSync.current(), 0)
  }, [key, deviceOn, setAccount, setSnapshot])

  const enable = useCallback(async () => {
    const result = access === 'prompt' ? await askDeviceAccess() : access
    setAccess(result)
    if (result === 'granted') {
      setDeviceWanted(true)
      setTimeout(() => latestSync.current(), 0)
    }
    return result
  }, [access, setDeviceWanted])

  const disable = useCallback(() => {
    setDeviceWanted(false)
    if (!key && !googleOn) setSnapshot({ events: [], syncedAt: new Date().toISOString() })
    else setTimeout(() => latestSync.current(), 0)
  }, [key, googleOn, setDeviceWanted, setSnapshot])

  const google = { available: googleConfigured, account: account ?? undefined, connecting, connect, disconnect }
  const device = { access, on: deviceOn, enable, disable, openSettings: () => void openCalendarSettings() }

  if (!active) return { events: [], status: 'off', sync, google, device }
  return { events: snapshot?.events ?? [], status, syncedAt: snapshot?.syncedAt, error, sync, google, device }
}
