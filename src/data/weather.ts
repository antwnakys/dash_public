/**
 * Live weather from Open-Meteo (free, no API key).
 * https://open-meteo.com/en/docs
 */
import type { Place, Weather } from '@/types'

const conditionFor = (code: number): Pick<Weather, 'condition' | 'summary'> => {
  if (code === 0) return { condition: 'clear', summary: 'Clear' }
  if (code <= 2) return { condition: 'partly-cloudy', summary: 'Partly cloudy' }
  if (code === 3) return { condition: 'cloudy', summary: 'Cloudy' }
  if (code <= 48) return { condition: 'fog', summary: 'Foggy' }
  if (code <= 57) return { condition: 'rain', summary: 'Drizzle' }
  if (code <= 67 || (code >= 80 && code <= 82)) return { condition: 'rain', summary: 'Rain' }
  if (code <= 77 || code === 85 || code === 86) return { condition: 'snow', summary: 'Snow' }
  return { condition: 'storm', summary: 'Thunderstorm' }
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
  if (!res.ok) throw new Error(`Weather service returned ${res.status}`)
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
  /** Local hour, e.g. "2026-11-06T17:00" (Europe/Athens). */
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
    timezone: 'Europe/Athens',
    forecast_days: '2',
  }).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather service returned ${res.status}`)
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
  if (!res.ok) throw new Error(`Location search returned ${res.status}`)
  const hit = (await res.json()).results?.[0]
  return hit ? { name: hit.name, latitude: hit.latitude, longitude: hit.longitude } : null
}
