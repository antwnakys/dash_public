import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

/**
 * A small OpenStreetMap map with one draggable pin. Loaded only when needed (lazy), so the app itself stays light.
 * `onMove` gets the new position when the pin is dropped.
 */
export default function PinMap({ latitude, longitude, onMove, label }: { latitude: number; longitude: number; onMove: (lat: number, lon: number) => void; label: string }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const pin = useRef<L.Marker | null>(null)
  const moveRef = useRef(onMove)
  useEffect(() => {
    moveRef.current = onMove
  })

  useEffect(() => {
    if (!box.current) return
    const m = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([latitude, longitude], 17)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(m)
    m.attributionControl.setPrefix(false)
    const icon = L.divIcon({ className: 'school-pin', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 28] })
    const marker = L.marker([latitude, longitude], { draggable: true, icon, keyboard: true, title: label, alt: label }).addTo(m)
    marker.on('dragend', () => {
      const p = marker.getLatLng()
      moveRef.current(p.lat, p.lng)
    })
    // Tap the map to move the pin there too.
    m.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      moveRef.current(e.latlng.lat, e.latlng.lng)
    })
    map.current = m
    pin.current = marker
    return () => {
      m.remove()
      map.current = null
    }
    // Created once; position updates below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const p = pin.current?.getLatLng()
    if (!p || Math.abs(p.lat - latitude) > 1e-7 || Math.abs(p.lng - longitude) > 1e-7) {
      pin.current?.setLatLng([latitude, longitude])
      map.current?.setView([latitude, longitude], Math.max(16, map.current.getZoom()))
    }
  }, [latitude, longitude])

  return <div ref={box} className="school-map h-56 w-full overflow-hidden rounded-[var(--radius-control)] ring-1 ring-line" />
}
