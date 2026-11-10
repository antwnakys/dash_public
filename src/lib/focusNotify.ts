/** "Time for a break" when a focus timer ends, even with dash in the background (iPhone app, Mac app). */
import { LocalNotifications } from '@capacitor/local-notifications'
import { isMacApp } from './macApp'
import { isNative } from './native'

const ID = 990_001

export async function scheduleFocusAlert(at: Date, title: string, body: string) {
  if (!isNative) return
  try {
    const { display } = await LocalNotifications.checkPermissions()
    if (display !== 'granted') return
    await LocalNotifications.cancel({ notifications: [{ id: ID }] })
    await LocalNotifications.schedule({ notifications: [{ id: ID, title, body, schedule: { at, allowWhileIdle: true } }] })
  } catch {
    // Older app builds: the in-app chime still plays.
  }
}

export async function cancelFocusAlert() {
  if (!isNative) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID }] })
  } catch {
    // Nothing scheduled.
  }
}

/** Mac app: a banner right now (the timer itself runs in the page, which stays alive in the menu bar). */
export async function macBanner(title: string, body: string) {
  if (!isMacApp) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('notify', { title, body })
  } catch {
    // Older Mac builds.
  }
}

/** A soft two-note chime, made on the spot (no sound file). */
export function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t = ctx.currentTime + i * 0.18
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 1)
    })
    setTimeout(() => ctx.close(), 1600)
  } catch {
    // No audio: the toast still says it.
  }
}
