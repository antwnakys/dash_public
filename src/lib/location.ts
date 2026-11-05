/**
 * Where the device is right now, for the weather.
 * iPhone app: the native location plugin, so iOS asks once and remembers (the web view's own location
 * prompt would come back on every launch). Website: the browser's.
 */
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import type { Place } from '@/types'
import { isNative } from './native'

const OPTIONS = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 }

function fromBrowser(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location is not available on this device'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      (e) => reject(new Error(e.message)),
      OPTIONS,
    )
  })
}

async function fromNative(): Promise<{ latitude: number; longitude: number }> {
  let { location } = await Geolocation.checkPermissions()
  if (location === 'prompt' || location === 'prompt-with-rationale') location = (await Geolocation.requestPermissions()).location
  if (location !== 'granted') throw new Error('Location is off for dash')
  const p = await Geolocation.getCurrentPosition(OPTIONS)
  return { latitude: p.coords.latitude, longitude: p.coords.longitude }
}

/** A short place name ("Marousi") for coordinates, rounded to about a kilometre before they leave the device. */
async function placeName(latitude: number, longitude: number): Promise<string> {
  try {
    const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client')
    url.search = new URLSearchParams({ latitude: latitude.toFixed(2), longitude: longitude.toFixed(2), localityLanguage: 'en' }).toString()
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const j = (await res.json()) as { locality?: string; city?: string }
    return j.locality || j.city || 'Current location'
  } catch {
    return 'Current location'
  }
}

/** Kilometres between two points (good enough at city scale). */
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const k = Math.PI / 180
  const x = (b.longitude - a.longitude) * k * Math.cos(((a.latitude + b.latitude) / 2) * k)
  const y = (b.latitude - a.latitude) * k
  return Math.sqrt(x * x + y * y) * 6371
}

/** Current position with a place name; the name is looked up again only after moving more than 1 km. */
export async function locate(previous?: Place): Promise<Place> {
  // An app build from before the native plugin was installed: wait for the reinstall instead of using the web
  // view's location, whose prompt would come back on every launch. The weather keeps the city meanwhile.
  if (isNative && !Capacitor.isPluginAvailable('Geolocation')) throw new Error('Needs the app update from Xcode')
  const pos = isNative ? await fromNative() : await fromBrowser()
  const name = previous && distanceKm(previous, pos) < 1 ? previous.name : await placeName(pos.latitude, pos.longitude)
  return { name, ...pos }
}
