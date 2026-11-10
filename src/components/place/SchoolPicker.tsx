import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, Search } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { addressAt, searchAddresses, searchPlaces, zoneCentre, type PlaceHit } from '@/data/places'
import { t } from '@/i18n'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import type { Place } from '@/types'

const PinMap = lazy(() => import('./PinMap'))

/**
 * "Where do you study?": search OpenStreetMap as you type, pick your school, then check the pin on a small map and drag
 * it onto the exact building. Fills the school's name and address (both still editable) and its exact position.
 * Used by the first-open setup and Settings; saving stays with them.
 */
export function SchoolPicker({
  place,
  near,
  onPick,
  onMove,
  autoFocus,
}: {
  /** The school's saved position, if any (shows the map). */
  place?: Place
  /** Where to look first (home or city), so nearby schools come first. */
  near?: { latitude: number; longitude: number }
  /** A search result was chosen. */
  onPick: (hit: PlaceHit) => void
  /** The pin was moved; `hit` has the address there when it could be found. */
  onMove: (latitude: number, longitude: number, hit: PlaceHit | null) => void
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [state, setState] = useState<'idle' | 'searching' | 'none' | 'failed'>('idle')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const where = near ?? zoneCentre()
  const timer = useRef<number | undefined>(undefined)
  const abort = useRef<AbortController | null>(null)

  // Search a moment after typing stops, cancelling the previous search.
  useEffect(() => {
    window.clearTimeout(timer.current)
    abort.current?.abort()
    if (query.trim().length < 3) {
      setHits([])
      setState('idle')
      return
    }
    timer.current = window.setTimeout(async () => {
      const ctrl = new AbortController()
      abort.current = ctrl
      setState('searching')
      try {
        const found = await searchPlaces(query, where, ctrl.signal)
        if (ctrl.signal.aborted) return
        setHits(found)
        setActive(0)
        setState(found.length ? 'idle' : 'none')
        setOpen(true)
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setState('failed')
      }
    }, 350)
    return () => window.clearTimeout(timer.current)
    // `near` only biases the order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Streets and numbers Photon missed: one Nominatim search when asked.
  const searchMore = async () => {
    const q = query.trim()
    if (q.length < 3) return
    abort.current?.abort()
    setState('searching')
    try {
      const found = await searchAddresses(q, where)
      setHits(found)
      setActive(0)
      setState(found.length ? 'idle' : 'none')
      setOpen(true)
    } catch {
      setState('failed')
    }
  }

  const pick = (hit: PlaceHit) => {
    onPick(hit)
    setQuery('')
    setHits([])
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label className="flex h-11 items-center gap-2.5 rounded-[var(--radius-control)] bg-fill px-3.5 focus-within:bg-surface focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_30%,transparent)]">
          <Search aria-hidden className="size-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => hits.length && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (!open || !hits.length)) {
                e.preventDefault()
                void searchMore()
                return
              }
              if (!open || !hits.length) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => Math.min(hits.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                pick(hits[active])
              } else if (e.key === 'Escape') setOpen(false)
            }}
            placeholder={t('place.searchPh')}
            aria-label={t('place.search')}
            role="combobox"
            aria-expanded={open && hits.length > 0}
            aria-controls="school-results"
            autoComplete="off"
            autoFocus={autoFocus}
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-faint focus:outline-none sm:text-[0.9375rem]"
          />
          {state === 'searching' && <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-faint border-t-transparent" aria-label={t('place.searching')} />}
        </label>
        <AnimatePresence>
          {open && hits.length > 0 && (
            <motion.ul
              id="school-results"
              role="listbox"
              // In the page's flow under the box (not floating): the setup's animated fields would otherwise paint over it.
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.smooth}
              className="surface mt-1.5 max-h-80 overflow-y-auto p-1"
            >
              {hits.map((h, i) => (
                <li key={`${h.latitude},${h.longitude},${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(h)}
                    className={cn('flex w-full items-start gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left', i === active && 'bg-fill')}
                  >
                    <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-body text-ink">{h.name ?? h.address}</span>
                      {h.name && <span className="block truncate text-caption text-muted">{h.address}</span>}
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={searchMore} className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left text-subhead font-medium text-accent hover:bg-fill">
                  <Search aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">{t('place.searchMore', { q: query.trim() })}</span>
                </button>
              </li>
            </motion.ul>
          )}
        </AnimatePresence>
        {state === 'none' && (
          <p className="mt-1.5 px-1 text-caption text-muted">
            {t('place.none')}{' '}
            <button type="button" onClick={searchMore} className="font-medium text-accent hover:underline">
              {t('place.searchMore', { q: query.trim() })}
            </button>
          </p>
        )}
        {state === 'failed' && <p className="mt-1.5 px-1 text-caption text-danger">{t('place.offline')}</p>}
      </div>
      {place && (
        <div className="flex flex-col gap-1.5">
          <Suspense fallback={<div className="h-56 w-full animate-pulse rounded-[var(--radius-control)] bg-fill" />}>
            <PinMap
              latitude={place.latitude}
              longitude={place.longitude}
              label={t('place.mapLabel')}
              onMove={async (lat, lon) => onMove(lat, lon, await addressAt(lat, lon).catch(() => null))}
            />
          </Suspense>
          <p className="px-1 text-caption text-faint">{t('place.dragHint')}</p>
        </div>
      )}
    </div>
  )
}
