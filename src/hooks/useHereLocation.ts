import { useEffect, useRef, useState } from 'react'
import { locate } from '@/lib/location'
import type { Place } from '@/types'

const KEY = 'dash.here.v1' // this device only: phone and laptop each keep their own
const EVERY = 2 * 60_000 // at most this often when coming back to the app

function stored(): Place | undefined {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? 'null') as Place | null) ?? undefined
  } catch {
    return undefined
  }
}

/**
 * This device's current location, refreshed every time dash is opened or comes back to the foreground.
 * `denied` once the user has said no (the weather then uses the city from Settings).
 */
export function useHereLocation(enabled: boolean): { here?: Place; denied: boolean } {
  const [here, setHere] = useState<Place | undefined>(stored)
  const [denied, setDenied] = useState(false)
  const last = useRef(0)
  const latest = useRef(here)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last.current < EVERY) return
      last.current = Date.now()
      locate(latest.current)
        .then((place) => {
          if (cancelled) return
          latest.current = place
          setHere(place)
          setDenied(false)
          try {
            localStorage.setItem(KEY, JSON.stringify(place))
          } catch {
            // Optional cache.
          }
        })
        .catch((e) => {
          if (!cancelled && e instanceof Error && /denied|off for dash|not authorized|permission/i.test(e.message)) setDenied(true)
        })
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled])

  return { here: enabled ? here : undefined, denied }
}
