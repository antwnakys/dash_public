/**
 * Live weather from Open-Meteo (free, no API key).
 * https://open-meteo.com/en/docs
 */
import { TIME_ZONE } from '@/lib/tripWeather'
import type { Place, Weather } from '@/types'
import { t } from '@/i18n'

const conditionFor = (code: number): Pick<Weather, 'condition' | 'summary'> => {
  if (code === 0) return { condition: 'clear', summary: t('wx.clear') }
  if (code <= 2) return { condition: 'partly-cloudy', summary: t('wx.partly') }
  if (code === 3) return { condition: 'cloudy', summary: t('wx.cloudy') }
  if (code <= 48) return { condition: 'fog', summary: t('wx.fog') }
  if (code <= 57) return { condition: 'rain', summary: t('wx.drizzle') }
  if (code <= 67 || (code >= 80 && code <= 82)) return { condition: 'rain', summary: t('wx.rain') }
  if (code <= 77 || code === 85 || code === 86) return { condition: 'snow', summary: t('wx.snow') }
  return { condition: 'storm', summary: t('wx.storm') }
}

export async function fetchWeather(place: Place): Promise<Weather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '1',
  }).toString()

  const res = await fetch(url)
  if (!res.ok) throw new Error(t('wx.serviceStatus', { status: res.status }))
  const json = await res.json()
  return {
    location: place.name,
    tempC: Math.round(json.current.temperature_2m),
    highC: Math.round(json.daily.temperature_2m_max[0]),
    lowC: Math.round(json.daily.temperature_2m_min[0]),
    ...conditionFor(json.current.weather_code),
  }
}

export interface HourlyPoint {
  /** Local hour in the device's time zone, e.g. "2026-11-06T17:00". */
  time: string
  tempC: number
  rainChance: number
  rainMm: number
  code: number
}

/** Next two days, hour by hour, for several places in one request (Open-Meteo accepts lists of coordinates). */
export async function fetchHourly(places: Array<{ latitude: number; longitude: number }>): Promise<HourlyPoint[][]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: places.map((p) => p.latitude).join(','),
    longitude: places.map((p) => p.longitude).join(','),
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code',
    timezone: TIME_ZONE,
    forecast_days: '2',
  }).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error(t('wx.serviceStatus', { status: res.status }))
  const json = await res.json()
  const list = Array.isArray(json) ? json : [json]
  return list.map((loc: { hourly: Record<string, Array<number | string | null>> }) =>
    loc.hourly.time.map((time, i) => ({
      time: String(time),
      tempC: Number(loc.hourly.temperature_2m[i] ?? 0),
      rainChance: Number(loc.hourly.precipitation_probability[i] ?? 0),
      rainMm: Number(loc.hourly.precipitation[i] ?? 0),
      code: Number(loc.hourly.weather_code[i] ?? 0),
    })),
  )
}

/** Look up a city by name. */
export async function searchPlace(query: string): Promise<Place | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.search = new URLSearchParams({ name: query, count: '1', format: 'json' }).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error(t('wx.searchStatus', { status: res.status }))
  const hit = (await res.json()).results?.[0]
  return hit ? { name: hit.name, latitude: hit.latitude, longitude: hit.longitude } : null
}

/**
 * Look up a street address or neighbourhood (OpenStreetMap's free Nominatim service, one request per save),
 * falling back to the city search with the last part of the address. The name is the area, for the weather.
 */
export async function searchAddress(query: string): Promise<Place | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', addressdetails: '1', 'accept-language': navigator.language || 'en' }).toString()
    const res = await fetch(url)
    if (res.ok) {
      const hit = (await res.json())[0] as
        | { lat: string; lon: string; name?: string; address?: Record<string, string | undefined> }
        | undefined
      if (hit) {
        const a = hit.address ?? {}
        const name = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.town ?? a.city_district ?? a.village ?? a.city ?? a.municipality ?? hit.name ?? query
        return { name, latitude: Number(hit.lat), longitude: Number(hit.lon) }
      }
    }
  } catch {
    // Try the city search below.
  }
  const parts = query.split(',').map((p) => p.replace(/\d+/g, '').trim()).filter(Boolean)
  for (const part of [...parts].reverse()) {
    const found = await searchPlace(part).catch(() => null)
    if (found) return found
  }
  return null
}
