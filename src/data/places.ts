/**
 * Finding the school on the map with OpenStreetMap, free and without an account:
 * - suggestions while typing from Photon (photon.komoot.io, built for search-as-you-type on OpenStreetMap data)
 * - the address under a dragged pin from Nominatim (reverse lookup, one request per drag)
 * Only the typed text, or the pin's coordinates, leave the device.
 */
import { locale } from '@/i18n'

export interface PlaceHit {
  /** The building or place name, when it has one ("Athens University of Economics and Business"). */
  name?: string
  /** "Patision 76, Exarcheia, Athens" */
  address: string
  /** Area for the weather ("Exarcheia"). */
  area: string
  latitude: number
  longitude: number
}

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
