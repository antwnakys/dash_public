import { Bike, Car, CloudLightning, Footprints, Snowflake, ThermometerSun, TrainFront, Umbrella, Video } from 'lucide-react'
import { useMemo } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { useTripForecast } from '@/hooks/useTripForecast'
import { schoolLabel } from '@/lib/school'
import { cn } from '@/lib/cn'
import { JoinButton } from '@/components/ui/JoinButton'
import { classesOn } from '@/lib/classes'
import { modeWords, nextDeparture } from '@/lib/commute'
import { fmt, startOfDay } from '@/lib/date'
import { tripHint, type TripHint } from '@/lib/tripWeather'

const hintIcon = { rain: Umbrella, storm: CloudLightning, cold: Snowflake, hot: ThermometerSun } as const

/** "Rain likely from 14:00 near school. Take an umbrella." */
function WeatherHint({ hint }: { hint: TripHint }) {
  const Icon = hintIcon[hint.kind]
  return (
    <span className={cn('mt-1 flex items-start gap-1.5 text-subhead font-medium', hint.kind === 'hot' || hint.kind === 'cold' ? 'text-ink' : 'text-accent')}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
      <span>{hint.text}</span>
    </span>
  )
}

const inWords = (mins: number) => (mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}`)

const SHOW_ONLINE_FROM = 3 * 3_600_000 // an online lesson's card appears 3 hours before it starts

/** "Statistics online at 17:00 · Join": today's next online lesson, until it ends. */
export function OnlineCard() {
  const { agenda, courses } = useDashboard()
  const now = useNow(30_000)
  const lesson = useMemo(
    () =>
      classesOn(now, agenda, courses.items).find(
        (c) => c.online && (c.end ?? new Date(c.start.getTime() + 3_600_000)) > now && c.start.getTime() - now.getTime() < SHOW_ONLINE_FROM,
      ),
    [agenda, courses.items, now],
  )
  if (!lesson) return null
  const started = lesson.start <= now
  return (
    <div className="surface flex items-center gap-3.5 px-4 py-3.5">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#5b5fc7]/16 text-[#7b7fe0]">
        <Video className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline text-ink">{started ? `${lesson.title} is on now` : `${lesson.title} online at ${fmt.time.format(lesson.start)}`}</span>
        <span className="block text-subhead text-muted">
          {lesson.link ? 'From home, no need to travel.' : 'From home. The meeting link will show here once it’s in the event.'}
        </span>
        {lesson.link && <JoinButton url={lesson.link} className="mt-2.5" />}
      </span>
    </div>
  )
}

const modeIcon = { transit: TrainFront, car: Car, walk: Footprints, bike: Bike } as const

/** "Leave by 08:10 for Databases": when to set off for the first class of the day. */
export function LeaveCard() {
  const { agenda, courses, profile, openEditor } = useDashboard()
  const now = useNow(30_000)
  const commute = profile.commute
  const minutes = commute?.minutes
  const trip = useMemo(() => nextDeparture(agenda, courses.items, now, commute), [agenda, courses.items, now, commute])
  const forecast = useTripForecast(Boolean(trip?.leaveAt), profile.home, profile.school?.place)
  const hint = useMemo(() => {
    if (!trip?.leaveAt || !forecast || !minutes) return undefined
    // At school until the last class of that day ends, then the trip home.
    const atSchool = classesOn(startOfDay(trip.classAt), agenda, courses.items).filter((c) => !c.online)
    const doneAt = new Date(Math.max(...atSchool.map((c) => (c.end ?? new Date(c.start.getTime() + 90 * 60_000)).getTime()), trip.classAt.getTime()))
    const backAt = new Date(doneAt.getTime() + minutes * 60_000)
    return tripHint(forecast.home, forecast.school, { leaveAt: trip.leaveAt, arriveAt: trip.classAt, doneAt, backAt })
  }, [trip, forecast, agenda, courses.items, minutes])
  if (!trip) return null

  const Icon = modeIcon[commute?.mode ?? 'transit']
  const open = () => openEditor({ type: 'settings', section: 'commute' })

  // No travel time yet: one tap to add it.
  if (!trip.leaveAt || !minutes) {
    return (
      <button onClick={open} className="surface flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-fill/60">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-headline text-ink">
            {trip.tomorrow ? 'Tomorrow' : 'Next'}: {trip.title} at {fmt.time.format(trip.classAt)}
          </span>
          <span className="block text-subhead text-accent">Add how long it takes to get to {schoolLabel(profile.school)} to see when to leave.</span>
        </span>
      </button>
    )
  }

  const leaveAt = trip.leaveAt
  const left = Math.ceil((leaveAt.getTime() - now.getTime()) / 60_000)
  const late = left <= 0
  const soon = !late && left <= 60 && !trip.tomorrow
  const headline = trip.tomorrow
    ? `Tomorrow, leave by ${fmt.time.format(leaveAt)}`
    : late
      ? 'Leave now'
      : soon
        ? `Leave in ${inWords(left)}`
        : `Leave by ${fmt.time.format(leaveAt)}`
  const detail = late
    ? `${inWords(-left)} later than usual. ${trip.title} starts at ${fmt.time.format(trip.classAt)}.`
    : `${trip.departure ? `Take the ${fmt.time.format(trip.departure)} · ` : ''}${trip.title} at ${fmt.time.format(trip.classAt)}`
  const route = [
    `About ${inWords(minutes)} door to door`,
    commute?.mode ? modeWords[commute.mode].label.toLowerCase() : undefined,
    profile.home && profile.school ? `${profile.home.name} → ${schoolLabel(profile.school)}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      onClick={open}
      aria-label={`${headline}. ${detail} Change travel time`}
      className="surface flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-fill/60"
    >
      <span
        aria-hidden
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          late ? 'bg-danger/14 text-danger' : soon ? 'bg-accent/12 text-accent' : 'bg-course/14 text-course',
        )}
      >
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-headline tabular-nums', late ? 'text-danger' : 'text-ink')}>{headline}</span>
        <span className="block text-subhead text-muted">{detail}</span>
        {hint && <WeatherHint hint={hint} />}
        <span className="mt-0.5 block truncate text-caption text-faint">{route}</span>
      </span>
    </button>
  )
}
