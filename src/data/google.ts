/**
 * Google sign-in and read-only Google Calendar access.
 * Web: OAuth popup (access token lasts an hour, then the user reconnects with one tap).
 * iOS: native Google Sign-In, which restores and refreshes the session silently.
 * Mac app: sign-in in the default browser (googleMac.ts), also refreshed silently.
 */
import { SocialLogin } from '@capgo/capacitor-social-login'
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/config'
import { findMeetingLink, findOtherLink, looksOnline } from '@/lib/meeting'
import { isMacApp } from '@/lib/macApp'
import { isNative } from '@/lib/native'
import { MacSignInExpired, macAccessToken, macForgetToken, macSignIn, macSignOut } from './googleMac'
import type { CalendarEvent } from '@/types'

// Read-only calendar, plus dash's own hidden folder in Drive for syncing between devices.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/drive.appdata']
const API = 'https://www.googleapis.com/calendar/v3'
const DAY_MS = 86_400_000

export const googleConfigured = Boolean(isNative || isMacApp ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID)

/** Thrown when Google needs the user to sign in again (expired or revoked access). */
export class GoogleReconnectError extends Error {}

let ready: Promise<void> | null = null

/** Sets up the plugin once. On the web this also completes a sign-in popup that loaded the app. */
export function initGoogle(): Promise<void> {
  if (!googleConfigured || isMacApp) return Promise.resolve()
  ready ??= SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
      mode: 'online',
    },
  })
  return ready
}

export interface GoogleAccount {
  email: string
  name?: string
}

export async function connectGoogle(): Promise<GoogleAccount> {
  invalidateGoogleToken()
  if (isMacApp) return macSignIn(SCOPES)
  await initGoogle()
  const res = await SocialLogin.login({ provider: 'google', options: { scopes: SCOPES } })
  const r = res.result as { responseType?: string; profile?: { email?: string | null; name?: string | null } }
  if (r.responseType === 'offline' || !r.profile?.email) throw new Error('Google didn’t return an account.')
  return { email: r.profile.email, name: r.profile.name ?? undefined }
}

export async function disconnectGoogle(): Promise<void> {
  invalidateGoogleToken()
  if (isMacApp) return macSignOut()
  await initGoogle()
  await SocialLogin.logout({ provider: 'google' }).catch(() => {})
}

const TOKEN_TIMEOUT = 15_000
const TOKEN_REUSE = 4 * 60_000

let cachedToken: { value: string; at: number } | null = null
let pendingToken: Promise<string> | null = null

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Google didn’t respond in time.')), ms)
    promise.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    )
  })
}

/** Forget the current token, e.g. after Google rejected it or the user signed in again. */
export function invalidateGoogleToken() {
  cachedToken = null
  if (isMacApp) macForgetToken()
}

/**
 * A valid access token. Calendar and data sync share one request: on iOS the sign-in plugin answers
 * only one of two simultaneous requests, which once left calendar sync waiting forever.
 */
export function googleAccessToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.at < TOKEN_REUSE) return Promise.resolve(cachedToken.value)
  pendingToken ??= (async () => {
    if (isMacApp) {
      try {
        const token = await macAccessToken()
        cachedToken = { value: token, at: Date.now() }
        return token
      } catch (e) {
        if (e instanceof MacSignInExpired) throw new GoogleReconnectError('Google sign-in has expired. Reconnect to keep syncing.')
        throw e
      }
    }
    await initGoogle()
    try {
      const { accessToken } = await withTimeout(SocialLogin.getAuthorizationCode({ provider: 'google' }), TOKEN_TIMEOUT)
      if (!accessToken) throw new Error('no token')
      cachedToken = { value: accessToken, at: Date.now() }
      return accessToken
    } catch (e) {
      if (e instanceof Error && /in time/.test(e.message)) throw e
      throw new GoogleReconnectError('Google sign-in has expired. Reconnect to keep syncing.')
    }
  })().finally(() => {
    pendingToken = null
  })
  return pendingToken
}

async function api<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(API + path)
  url.search = new URLSearchParams(params).toString()
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    invalidateGoogleToken()
    throw new GoogleReconnectError('Google sign-in has expired. Reconnect to keep syncing.')
  }
  if (res.status === 403) throw new Error('Google Calendar access was denied. Reconnect and allow calendar access.')
  if (!res.ok) throw new Error(`Google Calendar returned ${res.status}.`)
  return res.json() as Promise<T>
}

interface CalendarListEntry {
  id: string
  selected?: boolean
  primary?: boolean
  hidden?: boolean
}

interface GoogleEvent {
  id: string
  status?: string
  summary?: string
  location?: string
  description?: string
  hangoutLink?: string
  conferenceData?: { entryPoints?: Array<{ uri?: string }> }
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

/** Upcoming events from every calendar the user shows in Google Calendar. */
export async function fetchGoogleEvents(): Promise<CalendarEvent[]> {
  const token = await googleAccessToken()
  const { items: calendars = [] } = await api<{ items?: CalendarListEntry[] }>(token, '/users/me/calendarList', {
    minAccessRole: 'reader',
  })
  const shown = calendars.filter((c) => c.primary || (c.selected && !c.hidden))
  const timeMin = new Date(Date.now() - DAY_MS).toISOString()
  const timeMax = new Date(Date.now() + 180 * DAY_MS).toISOString()

  const perCalendar = await Promise.all(
    shown.map(async (cal) => {
      const out: CalendarEvent[] = []
      let pageToken: string | undefined
      for (let page = 0; page < 5; page++) {
        const data = await api<{ items?: GoogleEvent[]; nextPageToken?: string }>(
          token,
          `/calendars/${encodeURIComponent(cal.id)}/events`,
          {
            timeMin,
            timeMax,
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
            ...(pageToken ? { pageToken } : {}),
          },
        )
        for (const e of data.items ?? []) {
          if (e.status === 'cancelled' || !e.start) continue
          const allDay = Boolean(e.start.date && !e.start.dateTime)
          // All-day dates are calendar days, so read them as local midnight.
          const start = allDay ? new Date(`${e.start.date}T00:00`) : new Date(e.start.dateTime!)
          const link = findMeetingLink(e.description, e.location, e.hangoutLink, ...(e.conferenceData?.entryPoints ?? []).map((p) => p.uri))
          out.push({
            id: `g-${cal.id}-${e.id}`,
            title: e.summary?.trim() || '(No title)',
            start: start.toISOString(),
            end: !allDay && e.end?.dateTime ? new Date(e.end.dateTime).toISOString() : undefined,
            allDay: allDay || undefined,
            location: e.location || undefined,
            link,
            url: findOtherLink(e.description, e.location),
            online: looksOnline(link, e.summary, e.description) || undefined,
            kind: 'event',
          })
        }
        pageToken = data.nextPageToken
        if (!pageToken) break
      }
      return out
    }),
  )
  return perCalendar.flat()
}
