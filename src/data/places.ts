/**
 * Finding the school on the map with OpenStreetMap, free and without an account:
 * - suggestions while typing from Photon (photon.komoot.io, built for search-as-you-type on OpenStreetMap data)
 * - the address under a dragged pin from Nominatim (reverse lookup, one request per drag)
 * Only the typed text, or the pin's coordinates, leave the device.
 */
import { locale } from '@/i18n'
import type { Place } from '@/types'

export interface PlaceHit {
  /** The building or place name, when it has one ("Athens University of Economics and Business"). */
  name?: string
  /** "Patision 76, Exarcheia, Athens" */
  address: string
  /** Area for the weather ("Exarcheia"). */
  area: string
  latitude: number
  longitude: number
  /** From Google Maps search (`googlePlaces.ts`). */
  placeId?: string
}

/** The position to save for a picked result (Google's id kept, so its coordinates can be refreshed). */
export const placeOf = (hit: PlaceHit): Place => ({
  name: hit.area,
  latitude: hit.latitude,
  longitude: hit.longitude,
  ...(hit.placeId ? { placeId: hit.placeId, fetchedAt: Date.now() } : {}),
})

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: Record<string, string | undefined>
}

const PHOTON_LANGS = ['en', 'de', 'fr']

function fromPhoton(f: PhotonFeature): PlaceHit {
  const p = f.properties
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const area = p.district ?? p.locality ?? p.city ?? p.county ?? p.state ?? ''
  // A plain street (or a bare house number) has no name worth keeping; a university at a house number does.
  const isStreet = p.osm_key === 'highway' || p.type === 'street' || (p.osm_key === 'place' && p.osm_value === 'house')
  const name = !isStreet && p.name && p.name !== street ? p.name : undefined
  const address = [street || (isStreet ? p.name : undefined), area, area !== p.city ? p.city : undefined].filter(Boolean).join(', ')
  return { name, address: address || p.name || '', area: area || p.city || p.name || '', latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] }
}

/** Up to 6 matches for what's typed, nearest to `near` first when given. */
export async function searchPlaces(query: string, near?: { latitude: number; longitude: number }, signal?: AbortSignal): Promise<PlaceHit[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '6')
  const lang = locale.slice(0, 2)
  if (PHOTON_LANGS.includes(lang)) url.searchParams.set('lang', lang)
  if (near) {
    // Only roughly (about 10 km): enough to put nearby places first.
    url.searchParams.set('lat', near.latitude.toFixed(1))
    url.searchParams.set('lon', near.longitude.toFixed(1))
  }
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Place search returned ${res.status}`)
  const data = (await res.json()) as { features?: PhotonFeature[] }
  const hits = (data.features ?? []).map(fromPhoton).filter((h) => h.address)
  // The same building can come back twice (as a building and as an entrance).
  return hits.filter((h, i) => hits.findIndex((x) => x.address === h.address && x.name === h.name) === i)
}

/** The address at a point (after dragging the pin). */
export async function addressAt(latitude: number, longitude: number): Promise<PlaceHit | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.search = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', zoom: '18', addressdetails: '1', 'accept-language': navigator.language || 'en' }).toString()
  const res = await fetch(url)
  if (!res.ok) return null
  const hit = (await res.json()) as { name?: string; address?: Record<string, string | undefined> }
  const a = hit.address ?? {}
  const street = [a.road ?? a.pedestrian, a.house_number].filter(Boolean).join(' ')
  const area = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? a.town ?? a.village ?? a.city ?? ''
  const address = [street, area, area !== a.city ? a.city : undefined].filter(Boolean).join(', ')
  if (!address) return null
  return { name: hit.name && hit.name !== street ? hit.name : undefined, address, area: area || a.city || '', latitude, longitude }
}

// Where to look first when nothing is saved yet: the main city of the device's time zone (read on the device; nothing
// is sent anywhere just to guess). Without it, "University of Athens" would also show the University of Georgia.
const ZONE_CENTRE: Record<string, [number, number]> = {
  'Europe/Athens': [37.98, 23.73], 'Asia/Nicosia': [35.17, 33.36], 'Europe/Istanbul': [41.01, 28.98], 'Europe/London': [51.51, -0.13],
  'Europe/Dublin': [53.35, -6.26], 'Europe/Paris': [48.86, 2.35], 'Europe/Berlin': [52.52, 13.4], 'Europe/Madrid': [40.42, -3.7],
  'Europe/Rome': [41.9, 12.5], 'Europe/Lisbon': [38.72, -9.14], 'Europe/Amsterdam': [52.37, 4.9], 'Europe/Brussels': [50.85, 4.35],
  'Europe/Vienna': [48.21, 16.37], 'Europe/Zurich': [47.38, 8.54], 'Europe/Stockholm': [59.33, 18.07], 'Europe/Oslo': [59.91, 10.75],
  'Europe/Copenhagen': [55.68, 12.57], 'Europe/Helsinki': [60.17, 24.94], 'Europe/Warsaw': [52.23, 21.01], 'Europe/Prague': [50.08, 14.44],
  'Europe/Budapest': [47.5, 19.04], 'Europe/Bucharest': [44.43, 26.1], 'Europe/Sofia': [42.7, 23.32], 'Europe/Belgrade': [44.79, 20.45],
  'Europe/Kyiv': [50.45, 30.52], 'Europe/Kiev': [50.45, 30.52], 'Europe/Moscow': [55.75, 37.62], 'America/New_York': [40.71, -74.0],
  'America/Chicago': [41.88, -87.63], 'America/Denver': [39.74, -104.99], 'America/Los_Angeles': [34.05, -118.24],
  'America/Toronto': [43.65, -79.38], 'America/Mexico_City': [19.43, -99.13], 'America/Sao_Paulo': [-23.55, -46.63],
  'America/Argentina/Buenos_Aires': [-34.6, -58.38], 'Asia/Tokyo': [35.68, 139.69], 'Asia/Seoul': [37.57, 126.98],
  'Asia/Shanghai': [31.23, 121.47], 'Asia/Hong_Kong': [22.32, 114.17], 'Asia/Singapore': [1.35, 103.82], 'Asia/Kolkata': [28.61, 77.21],
  'Asia/Karachi': [24.86, 67.0], 'Asia/Dubai': [25.2, 55.27], 'Asia/Riyadh': [24.71, 46.68], 'Africa/Cairo': [30.04, 31.24],
  'Asia/Jakarta': [-6.2, 106.85], 'Australia/Sydney': [-33.87, 151.21],
}

export function zoneCentre(): { latitude: number; longitude: number } | undefined {
  try {
    const c = ZONE_CENTRE[Intl.DateTimeFormat().resolvedOptions().timeZone]
    return c ? { latitude: c[0], longitude: c[1] } : undefined
  } catch {
    return undefined
  }
}

/**
 * Search addresses with Nominatim, only when the person asks for it ("Search addresses for …"): it finds streets and
 * numbers that Photon's suggestions miss. One request per press, as Nominatim's rules ask (no search-as-you-type).
 */
export async function searchAddresses(query: string, near?: { latitude: number; longitude: number }): Promise<PlaceHit[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  const params: Record<string, string> = { q: query.trim(), format: 'jsonv2', limit: '6', addressdetails: '1', 'accept-language': navigator.language || 'en' }
  if (near) {
    // Prefer about 100 km around, without excluding anything.
    params.viewbox = [near.longitude - 1, near.latitude + 1, near.longitude + 1, near.latitude - 1].map((n) => n.toFixed(2)).join(',')
  }
  url.search = new URLSearchParams(params).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Address search returned ${res.status}`)
  const list = (await res.json()) as Array<{ lat: string; lon: string; name?: string; address?: Record<string, string | undefined> }>
  return list.map((hit) => {
    const a = hit.address ?? {}
    const street = [a.road ?? a.pedestrian, a.house_number].filter(Boolean).join(' ')
    const area = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? a.town ?? a.village ?? a.city ?? ''
    const address = [street, area, area !== a.city ? a.city : undefined].filter(Boolean).join(', ') || hit.name || query
    return { name: hit.name && hit.name !== street && hit.name !== a.road ? hit.name : undefined, address, area: area || a.city || '', latitude: Number(hit.lat), longitude: Number(hit.lon) }
  })
}
