import { useEffect, useRef, useState } from 'react'
import { fetchHourly, type HourlyPoint } from '@/data/weather'
import type { Place } from '@/types'

const KEY = 'unidash.tripweather.v1'
const MAX_AGE = 30 * 60_000

interface Forecast {
  home?: { name: string; hours: HourlyPoint[] }
  school?: { name: string; hours: HourlyPoint[] }
}

const placeId = (home?: Place, school?: Place) => [home, school].map((p) => (p ? `${p.latitude},${p.longitude}` : '-')).join('|')

function cached(id: string): Forecast | undefined {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at: number; id: string; data: Forecast } | null
    return c && c.id === id && Date.now() - c.at < MAX_AGE ? c.data : undefined
  } catch {
    return undefined
  }
}

/** Hourly forecast for home and school, fetched only while a trip is coming up; cached for 30 minutes. */
export function useTripForecast(active: boolean, home?: Place, school?: Place): Forecast | undefined {
  const id = placeId(home, school)
  const [data, setData] = useState<{ id: string; forecast: Forecast } | undefined>(() => {
    const c = cached(id)
    return c && { id, forecast: c }
  })

  // The places themselves change identity on every profile save; `id` says when they really moved.
  const places = useRef({ home, school })
  useEffect(() => {
    places.current = { home, school }
  })

  useEffect(() => {
    const { home, school } = places.current
    if (!active || (!home && !school) || cached(id)) return
    let cancelled = false
    fetchHourly([home, school].filter((p): p is Place => Boolean(p)))
      .then((lists) => {
        if (cancelled) return
        const fresh: Forecast = {
          home: home && lists[0] ? { name: home.name, hours: lists[0] } : undefined,
          school: school && lists[home ? 1 : 0] ? { name: school.name, hours: lists[home ? 1 : 0] } : undefined,
        }
        try {
          localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), id, data: fresh }))
        } catch {
          // Cache is optional.
        }
        setData({ id, forecast: fresh })
      })
      .catch(() => {
        // No hint when offline; the card works without it.
      })
    return () => {
      cancelled = true
    }
  }, [active, id])

  return active && data?.id === id ? data.forecast : undefined
}
