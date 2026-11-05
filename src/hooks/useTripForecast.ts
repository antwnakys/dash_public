import { useEffect, useState } from 'react'
import { fetchHourly, type HourlyPoint } from '@/data/weather'
import { CAMPUS_PLACE, HOME_PLACE } from '@/lib/commute'

const KEY = 'dash.tripweather.v1'
const MAX_AGE = 30 * 60_000

interface Forecast {
  home: HourlyPoint[]
  campus: HourlyPoint[]
}

function cached(): Forecast | undefined {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at: number; data: Forecast } | null
    return c && Date.now() - c.at < MAX_AGE ? c.data : undefined
  } catch {
    return undefined
  }
}

/** Hourly forecast for home and campus, fetched only while a trip is coming up; cached for 30 minutes. */
export function useTripForecast(active: boolean): Forecast | undefined {
  const [data, setData] = useState<Forecast | undefined>(cached)

  useEffect(() => {
    if (!active || cached()) return
    let cancelled = false
    fetchHourly([HOME_PLACE, CAMPUS_PLACE])
      .then(([home, campus]) => {
        if (cancelled || !home || !campus) return
        const fresh = { home, campus }
        try {
          localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data: fresh }))
        } catch {
          // Cache is optional.
        }
        setData(fresh)
      })
      .catch(() => {
        // No hint when offline; the card works without it.
      })
    return () => {
      cancelled = true
    }
  }, [active])

  return active ? data : undefined
}
