/**
 * One line of advice for the trip to school: rain, storms, cold or heat while you're out.
 * Looks at home around leaving and coming back, and at school while you're there.
 */
import type { HourlyPoint } from '@/data/weather'
import { t } from '@/i18n'

export interface TripHint {
  kind: 'storm' | 'rain' | 'cold' | 'hot'
  text: string
}

const RAIN_CHANCE = 50 // %
const RAIN_MM = 0.3 // mm in an hour counts even when the chance is lower
const COLD = 10 // °C
const HOT = 33 // °C

/** The device's time zone; Open-Meteo is asked for hours in the same zone. */
export const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const localHour = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})
/** "2026-11-06T17:00" for the local hour containing `d`, to match Open-Meteo's times. */
export function hourKey(d: Date): string {
  const p = Object.fromEntries(localHour.formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:00`
}

const hourLabel = (key: string) => key.slice(11, 16)

/**
 * `home` and `school` are hourly forecasts with their place names. You're at/near home from `leaveAt` for the
 * trip, at school from `arriveAt` to `doneAt`, then travel home until `backAt`.
 */
export function tripHint(
  home: { name: string; hours: HourlyPoint[] } | undefined,
  school: { name: string; hours: HourlyPoint[] } | undefined,
  times: { leaveAt: Date; arriveAt: Date; doneAt: Date; backAt: Date },
): TripHint | undefined {
  const pick = (list: HourlyPoint[], from: Date, to: Date, where: string) => {
    const a = hourKey(from)
    const b = hourKey(to)
    return list.filter((h) => h.time >= a && h.time <= b).map((h) => ({ ...h, where }))
  }
  const hours = [
    ...(home ? pick(home.hours, times.leaveAt, times.arriveAt, home.name) : []),
    ...(school ? pick(school.hours, times.arriveAt, times.doneAt, school.name) : []),
    ...(home ? pick(home.hours, times.doneAt, times.backAt, home.name) : []),
  ].sort((x, y) => x.time.localeCompare(y.time))
  if (!hours.length) return undefined

  const storm = hours.find((h) => h.code >= 95)
  if (storm) return { kind: 'storm', text: t('trip.storm', { time: hourLabel(storm.time), place: storm.where }) }

  const rain = hours.find((h) => h.rainChance >= RAIN_CHANCE || h.rainMm >= RAIN_MM)
  if (rain) {
    const leaving = rain.time <= hourKey(times.leaveAt)
    return {
      kind: 'rain',
      text: leaving
        ? t('trip.rainLeaving', { chance: Math.round(rain.rainChance) })
        : t('trip.rain', { time: hourLabel(rain.time), place: rain.where, chance: Math.round(rain.rainChance) }),
    }
  }

  const coldest = hours.reduce((m, h) => (h.tempC < m.tempC ? h : m))
  if (coldest.tempC <= COLD) return { kind: 'cold', text: t('trip.cold', { temp: Math.round(coldest.tempC), time: hourLabel(coldest.time) }) }

  const hottest = hours.reduce((m, h) => (h.tempC > m.tempC ? h : m))
  if (hottest.tempC >= HOT) return { kind: 'hot', text: t('trip.hot', { temp: Math.round(hottest.tempC), place: hottest.where }) }

  return undefined
}
