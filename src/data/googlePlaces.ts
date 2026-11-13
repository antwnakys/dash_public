/**
 * School / work search with Google Maps (Places API (New), called from the browser with the public key in config).
 * Typing gives suggestions (Autocomplete); picking one fetches its position and address (Place Details). Both share a
 * session token, which Google bills as one free session. Only the typed text and a rough position (to rank nearby
 * places first) are sent.
 *
 * Any failure that isn't a cancelled request (no key, the daily cap reached, billing off, offline) turns Google off for
 * the rest of this page load and the picker goes back to the free OpenStreetMap search.
 */
import { GOOGLE_MAPS_KEY } from '@/config'
import { locale } from '@/i18n'
import type { Place } from '@/types'
import type { PlaceHit } from './places'

const API = 'https://places.googleapis.com/v1'
let down = false

/** Google search can be used right now. */
export const googleOn = () => Boolean(GOOGLE_MAPS_KEY) && !down

export class GoogleUnavailable extends Error {}

async function call<T>(path: string, init: RequestInit & { fields?: string }): Promise<T> {
  const headers: Record<string, string> = { 'X-Goog-Api-Key': GOOGLE_MAPS_KEY, 'Content-Type': 'application/json' }
  if (init.fields) headers['X-Goog-FieldMask'] = init.fields
  let res: Response
  try {
    res = await fetch(`${API}${path}`, { ...init, headers })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    down = true
    throw new GoogleUnavailable('offline')
  }
  if (!res.ok) {
    down = true
    throw new GoogleUnavailable(`Google Places returned ${res.status}`)
  }
  return (await res.json()) as T
}

/** A new search session (one per visit to the picker, renewed after each pick). */
export const newSession = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

/** A suggestion while typing; its position comes from `googlePlace` once picked. */
export interface GoogleSuggestion {
  placeId: string
  /** The place's name, or the street and number for a plain address. */
  title: string
  /** The rest of the address. */
  detail?: string
  /** A business or building (keeps its name), not just an address. */
  named: boolean
}

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string
      types?: string[]
      text?: { text: string }
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } }
    }
  }>
}

const ADDRESS_TYPES = new Set(['street_address', 'route', 'premise', 'subpremise', 'street_number', 'intersection', 'postal_code', 'geocode'])

export async function suggestGoogle(query: string, session: string, near?: { latitude: number; longitude: number }, signal?: AbortSignal): Promise<GoogleSuggestion[]> {
  const body: Record<string, unknown> = { input: query.trim(), sessionToken: session, languageCode: locale }
  // Nearby places first (about 50 km), without hiding the rest.
  if (near) body.locationBias = { circle: { center: { latitude: near.latitude, longitude: near.longitude }, radius: 50_000 } }
  const data = await call<AutocompleteResponse>('/places:autocomplete', { method: 'POST', body: JSON.stringify(body), signal })
  return (data.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction
    if (!p) return []
    const title = p.structuredFormat?.mainText?.text ?? p.text?.text ?? ''
    const named = !(p.types ?? []).some((t) => ADDRESS_TYPES.has(t))
    return title ? [{ placeId: p.placeId, title, detail: p.structuredFormat?.secondaryText?.text, named }] : []
  })
}

interface DetailsResponse {
  shortFormattedAddress?: string
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  addressComponents?: Array<{ longText: string; types: string[] }>
}

// Only "Essentials" fields (no name, photos or ratings): the cheapest kind of Place Details, inside the free allowance.
const FIELDS = 'shortFormattedAddress,formattedAddress,location,addressComponents'

async function details(placeId: string, session?: string): Promise<DetailsResponse> {
  const q = new URLSearchParams({ languageCode: locale })
  if (session) q.set('sessionToken', session)
  return call<DetailsResponse>(`/places/${encodeURIComponent(placeId)}?${q}`, { method: 'GET', fields: FIELDS })
}

const component = (d: DetailsResponse, ...types: string[]) => types.map((t) => d.addressComponents?.find((c) => c.types.includes(t))?.longText).find(Boolean)

/** The picked suggestion with its position and address, ready for the school/work fields. */
export async function googlePlace(s: GoogleSuggestion, session: string): Promise<PlaceHit> {
  const d = await details(s.placeId, session)
  if (!d.location) throw new GoogleUnavailable('No position for this place')
  const area = component(d, 'sublocality_level_1', 'sublocality', 'neighborhood', 'locality', 'postal_town', 'administrative_area_level_3') ?? ''
  return {
    name: s.named ? s.title : undefined,
    address: d.shortFormattedAddress ?? d.formattedAddress ?? [s.title, s.detail].filter(Boolean).join(', '),
    area: area || component(d, 'locality') || '',
    latitude: d.location.latitude,
    longitude: d.location.longitude,
    placeId: s.placeId,
  }
}

const MONTH = 30 * 86_400_000

/** Google lets apps keep its coordinates for 30 days: older ones are fetched again by the place id. */
export async function refreshPlace(place: Place | undefined, now = Date.now()): Promise<Place | undefined> {
  if (!place?.placeId || !googleOn() || now - (place.fetchedAt ?? 0) < MONTH) return undefined
  const d = await details(place.placeId)
  if (!d.location) return undefined
  return { ...place, latitude: d.location.latitude, longitude: d.location.longitude, fetchedAt: now }
}
