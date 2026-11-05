/** Shared by the first-open setup and Settings: travel choices and looking up typed places. */
import { searchAddress } from '@/data/weather'
import type { CommuteMode, Place } from '@/types'

export const modes: Array<{ value: CommuteMode; label: string }> = [
  { value: 'transit', label: 'Transit' },
  { value: 'car', label: 'Car' },
  { value: 'walk', label: 'Walk' },
  { value: 'bike', label: 'Bike' },
]

/** 5 min to 3 hours, finer steps for short trips. */
export const minuteOptions = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180]

export const minutesLabel = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`)

/** Days a monthly pass can run out on (29–31 don't exist every month). */
export const passDays = Array.from({ length: 28 }, (_, i) => i + 1)

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`
export const dayLabel = (n: number) => `the ${ordinal(n)}`

/**
 * The place for typed text, keeping the previous result when the text hasn't changed.
 * `undefined` when nothing was typed or nothing was found; `found` says which.
 */
export async function lookUp(text: string, previous?: { text?: string; place?: Place }): Promise<{ place?: Place; found: boolean }> {
  const t = text.trim()
  if (!t) return { found: true }
  if (previous?.place && previous.text?.trim() === t) return { place: previous.place, found: true }
  const place = (await searchAddress(t)) ?? undefined
  return { place, found: Boolean(place) }
}
