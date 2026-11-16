/**
 * This iPhone's calendars (Apple Calendar and the accounts added in iOS Settings), read through the native
 * DeviceCalendar plugin (ios/App/App/SceneDelegate.swift). Read-only, on the device only: the events join the
 * local calendar copy like Google's and are never uploaded. Older app builds without the plugin report
 * "unavailable", so the website and old installs simply don't offer it.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { findMeetingLink, findOtherLink, looksOnline } from '@/lib/meeting'
import { isNative } from '@/lib/native'
import type { CalendarEvent } from '@/types'
import { t } from '@/i18n'

export type DeviceAccess = 'granted' | 'prompt' | 'denied' | 'unavailable'

interface RawEvent {
  id: string
  series: string
  title: string
  start: number
  end: number
  allDay: boolean
  location?: string
  notes?: string
  url?: string
}

interface DeviceCalendarPlugin {
  status(): Promise<{ status: DeviceAccess }>
  request(): Promise<{ status: DeviceAccess }>
  events(options: { from: number; to: number }): Promise<{ events: RawEvent[] }>
  openSettings(): Promise<void>
  addListener(event: 'change', fn: () => void): Promise<PluginListenerHandle>
}

const Plugin = registerPlugin<DeviceCalendarPlugin>('DeviceCalendar')
const DAY_MS = 86_400_000

export async function deviceAccess(): Promise<DeviceAccess> {
  if (!isNative) return 'unavailable'
  try {
    return (await Plugin.status()).status
  } catch {
    return 'unavailable'
  }
}

export async function askDeviceAccess(): Promise<DeviceAccess> {
  try {
    return (await Plugin.request()).status
  } catch {
    return 'unavailable'
  }
}

export const openCalendarSettings = () => Plugin.openSettings().catch(() => undefined)

/** Calendar changes made in other apps. */
export const onDeviceCalendarChange = (fn: () => void) => Plugin.addListener('change', fn).catch(() => undefined)

/** The phone's events from a month back to six months ahead (same window as Google). */
export async function fetchDeviceEvents(now = Date.now()): Promise<CalendarEvent[]> {
  const { events } = await Plugin.events({ from: now - 31 * DAY_MS, to: now + 180 * DAY_MS })
  return events.map((e) => {
    const link = findMeetingLink(e.notes, e.location, e.url)
    return {
      id: `ios-${e.id}`,
      title: e.title.trim() || t('event.untitled'),
      start: new Date(e.start).toISOString(),
      end: e.allDay ? undefined : new Date(e.end).toISOString(),
      allDay: e.allDay || undefined,
      location: e.location,
      link,
      url: findOtherLink(e.notes, e.location) ?? (e.url && e.url !== link ? e.url : undefined),
      online: looksOnline(link, e.title, e.notes) || undefined,
      kind: 'event',
      series: `ios-${e.series}`,
    }
  })
}
