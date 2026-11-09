/** Shared by the first-open setup and Settings: travel choices and looking up typed places. */
import { searchAddress } from '@/data/weather'
import type { CommuteMode, Place } from '@/types'
import { locale, t } from '@/i18n'

export const modes: Array<{ value: CommuteMode; label: string }> = [
  { value: 'transit', label: t('modeShort.transit') },
  { value: 'car', label: t('modeShort.car') },
  { value: 'walk', label: t('modeShort.walk') },
  { value: 'bike', label: t('modeShort.bike') },
]

/** 5 min to 3 hours, finer steps for short trips. */
export const minuteOptions = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180]

const unit = (u: 'hour' | 'minute') => new Intl.NumberFormat(locale, { style: 'unit', unit: u, unitDisplay: 'short' })
const hours = unit('hour')
const minutes = unit('minute')
type DurationFormat = { format(d: { hours?: number; minutes?: number }): string }
const Duration = (Intl as unknown as { DurationFormat?: new (l: string, o: object) => DurationFormat }).DurationFormat
const duration = Duration ? new Duration(locale, { style: 'short' }) : undefined

/** "45 min", "1 hr 30 min", in the page's language. */
export const minutesLabel = (m: number) => {
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (duration) return duration.format(h ? { hours: h, ...(rest ? { minutes: rest } : {}) } : { minutes: m })
  return h ? [hours.format(h), rest ? minutes.format(rest) : ''].filter(Boolean).join(' ') : minutes.format(m)
}

/** Days a monthly pass can run out on (29–31 don't exist every month). */
export const passDays = Array.from({ length: 28 }, (_, i) => i + 1)

/** "Day 3 of each month". */
export const dayLabel = (n: number) => t('pass.dayOption', { n })

/**
 * The place for typed text, keeping the previous result when the text hasn't changed.
 * `undefined` when nothing was typed or nothing was found; `found` says which.
 */
export async function lookUp(text: string, previous?: { text?: string; place?: Place }): Promise<{ place?: Place; found: boolean }> {
  const typed = text.trim()
  if (!typed) return { found: true }
  if (previous?.place && previous.text?.trim() === typed) return { place: previous.place, found: true }
  const place = (await searchAddress(typed)) ?? undefined
  return { place, found: Boolean(place) }
}
