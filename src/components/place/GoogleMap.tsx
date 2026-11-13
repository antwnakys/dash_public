import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { GOOGLE_MAPS_KEY } from '@/config'
import { locale } from '@/i18n'

const PinMap = lazy(() => import('./PinMap'))

// Just the parts of the Maps JavaScript API used here (the full types aren't installed).
interface LatLng { lat(): number; lng(): number }
interface MapsEvent { latLng?: LatLng }
interface Listenable { addListener(name: string, fn: (e: MapsEvent) => void): void }
interface GMap extends Listenable { setCenter(p: { lat: number; lng: number }): void; getZoom(): number; setZoom(z: number): void }
interface GMarker extends Listenable { setPosition(p: LatLng | { lat: number; lng: number }): void; getPosition(): LatLng | undefined }
interface MapsApi {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap
  Marker: new (opts: Record<string, unknown>) => GMarker
}
type MapsWindow = Window & { google?: { maps?: MapsApi }; gm_authFailure?: () => void; __unidashMapsReady?: () => void }

let loading: Promise<MapsApi> | undefined
let failed = false

/** Loads the Maps JavaScript API once. A bad key or billing turned off reports through `gm_authFailure`. */
function loadMaps(): Promise<MapsApi> {
  const w = window as MapsWindow
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps)
  loading ??= new Promise<MapsApi>((resolve, reject) => {
    w.__unidashMapsReady = () => (w.google?.maps ? resolve(w.google.maps) : reject(new Error('Maps did not load')))
    const script = document.createElement('script')
    const q = new URLSearchParams({ key: GOOGLE_MAPS_KEY, v: 'weekly', callback: '__unidashMapsReady', language: locale })
    script.src = `https://maps.googleapis.com/maps/api/js?${q}`
    script.async = true
    script.onerror = () => {
      loading = undefined
      reject(new Error('Maps did not load'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/**
 * A small Google map with one draggable pin, for a place picked from Google search (Google's rules want its places
 * on its own map). `onMove` gets the new position when the pin is dropped or the map is tapped. If the map can't
 * load (offline, daily cap reached), the OpenStreetMap one takes its place.
 */
export default function GoogleMap({ latitude, longitude, onMove, label }: { latitude: number; longitude: number; onMove: (lat: number, lon: number) => void; label: string }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<GMap | null>(null)
  const pin = useRef<GMarker | null>(null)
  const moveRef = useRef(onMove)
  const [broken, setBroken] = useState(failed)
  useEffect(() => {
    moveRef.current = onMove
  })

  useEffect(() => {
    if (broken) return
    let gone = false
    const w = window as MapsWindow
    w.gm_authFailure = () => {
      failed = true
      setBroken(true)
    }
    loadMaps().then(
      (maps) => {
        if (gone || !box.current) return
        const center = { lat: latitude, lng: longitude }
        const m = new maps.Map(box.current, {
          center,
          zoom: 17,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        })
        // The classic marker: the newer one needs a map style id from the Cloud console.
        const marker = new maps.Marker({ position: center, map: m, draggable: true, title: label })
        marker.addListener('dragend', () => {
          const p = marker.getPosition()
          if (p) moveRef.current(p.lat(), p.lng())
        })
        m.addListener('click', (e) => {
          if (!e.latLng) return
          marker.setPosition(e.latLng)
          moveRef.current(e.latLng.lat(), e.latLng.lng())
        })
        map.current = m
        pin.current = marker
      },
      () => {
        failed = true
        if (!gone) setBroken(true)
      },
    )
    return () => {
      gone = true
      map.current = null
      pin.current = null
    }
    // Created once; position updates below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broken])

  useEffect(() => {
    const p = pin.current?.getPosition()
    if (!p || Math.abs(p.lat() - latitude) > 1e-7 || Math.abs(p.lng() - longitude) > 1e-7) {
      pin.current?.setPosition({ lat: latitude, lng: longitude })
      map.current?.setCenter({ lat: latitude, lng: longitude })
      if (map.current && map.current.getZoom() < 16) map.current.setZoom(16)
    }
  }, [latitude, longitude])

  if (broken)
    return (
      <Suspense fallback={<div className="h-56 w-full animate-pulse rounded-[var(--radius-control)] bg-fill" />}>
        <PinMap latitude={latitude} longitude={longitude} onMove={onMove} label={label} />
      </Suspense>
    )
  return <div ref={box} aria-label={label} role="region" className="h-56 w-full overflow-hidden rounded-[var(--radius-control)] bg-fill ring-1 ring-line" />
}
