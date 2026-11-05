/**
 * One line of advice for the trip to campus: rain, storms, cold or heat while you're out.
 * Looks at home (Argyroupoli) around leaving and coming back, and at Marousi while you're on campus.
 */
import type { HourlyPoint } from '@/data/weather'

export interface TripHint {
  kind: 'storm' | 'rain' | 'cold' | 'hot'
  text: string
}

const RAIN_CHANCE = 50 // %
const RAIN_MM = 0.3 // mm in an hour counts even when the chance is lower
const COLD = 10 // °C
const HOT = 33 // °C

const athensHour = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Athens',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})
/** "2026-11-06T17:00" for the Athens hour containing `d`, to match Open-Meteo's local times. */
export function hourKey(d: Date): string {
  const p = Object.fromEntries(athensHour.formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:00`
}

const hourLabel = (key: string) => key.slice(11, 16)

/**
 * `home` and `campus` are hourly forecasts. You're at/near home from `leaveAt` for the trip, on campus from
 * `arriveAt` to `doneAt`, then travel home until `backAt`.
 */
export function tripHint(
  home: HourlyPoint[],
  campus: HourlyPoint[],
  times: { leaveAt: Date; arriveAt: Date; doneAt: Date; backAt: Date },
): TripHint | undefined {
  const pick = (list: HourlyPoint[], from: Date, to: Date, where: string) => {
    const a = hourKey(from)
    const b = hourKey(to)
    return list.filter((h) => h.time >= a && h.time <= b).map((h) => ({ ...h, where }))
  }
  const hours = [
    ...pick(home, times.leaveAt, times.arriveAt, 'Argyroupoli'),
    ...pick(campus, times.arriveAt, times.doneAt, 'Marousi'),
    ...pick(home, times.doneAt, times.backAt, 'Argyroupoli'),
  ].sort((x, y) => x.time.localeCompare(y.time))
  if (!hours.length) return undefined

  const storm = hours.find((h) => h.code >= 95)
  if (storm) return { kind: 'storm', text: `Thunderstorms around ${hourLabel(storm.time)} in ${storm.where}. Take an umbrella.` }

  const rain = hours.find((h) => h.rainChance >= RAIN_CHANCE || h.rainMm >= RAIN_MM)
  if (rain) {
    const leaving = rain.time <= hourKey(times.leaveAt)
    return {
      kind: 'rain',
      text: leaving
        ? `Rain when you leave (${Math.round(rain.rainChance)}%). Take an umbrella.`
        : `Rain likely from ${hourLabel(rain.time)} in ${rain.where} (${Math.round(rain.rainChance)}%). Take an umbrella.`,
    }
  }

  const coldest = hours.reduce((m, h) => (h.tempC < m.tempC ? h : m))
  if (coldest.tempC <= COLD) return { kind: 'cold', text: `Down to ${Math.round(coldest.tempC)}° around ${hourLabel(coldest.time)}. Take a jacket.` }

  const hottest = hours.reduce((m, h) => (h.tempC > m.tempC ? h : m))
  if (hottest.tempC >= HOT) return { kind: 'hot', text: `Up to ${Math.round(hottest.tempC)}° in ${hottest.where}. Bring water.` }

  return undefined
}
