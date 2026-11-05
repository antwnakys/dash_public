import { CloudLightning, Snowflake, ThermometerSun, TrainFront, Umbrella, Video } from 'lucide-react'
import { useMemo } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { useTripForecast } from '@/hooks/useTripForecast'
import { CAMPUS } from '@/lib/campus'
import { cn } from '@/lib/cn'
import { JoinButton } from '@/components/ui/JoinButton'
import { classesOn } from '@/lib/classes'
import { COMMUTE_ROUTE, DEFAULT_COMMUTE, nextDeparture, TO_TRAIN } from '@/lib/commute'
import { fmt, startOfDay } from '@/lib/date'
import { tripHint, type TripHint } from '@/lib/tripWeather'

const hintIcon = { rain: Umbrella, storm: CloudLightning, cold: Snowflake, hot: ThermometerSun } as const

/** "Rain likely from 14:00 in Marousi. Take an umbrella." */
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

/** "Academic Skills online at 17:00 · Join on Teams": today's next online lesson, until it ends. */
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
          {lesson.link ? 'From home, no need to travel.' : 'From home. The Teams link will appear here once it arrives.'}
        </span>
        {lesson.link && <JoinButton url={lesson.link} className="mt-2.5" />}
      </span>
    </div>
  )
}

/** "Leave by 08:10 for Databases": when to set off for the first class of the day. */
export function LeaveCard() {
  const { agenda, courses, profile, openEditor } = useDashboard()
  const now = useNow(30_000)
  const minutes = profile.commuteMinutes ?? DEFAULT_COMMUTE
  const trains = profile.suburbanTrains
  const trip = useMemo(() => nextDeparture(agenda, courses.items, now, minutes, trains), [agenda, courses.items, now, minutes, trains])
  const forecast = useTripForecast(Boolean(trip))
  const hint = useMemo(() => {
    if (!trip || !forecast) return undefined
    // On campus until the last class of that day ends, then the trip home.
    const onCampus = classesOn(startOfDay(trip.classAt), agenda, courses.items).filter((c) => !c.online)
    const doneAt = new Date(Math.max(...onCampus.map((c) => (c.end ?? new Date(c.start.getTime() + 90 * 60_000)).getTime()), trip.classAt.getTime()))
    const backAt = new Date(doneAt.getTime() + minutes * 60_000)
    return tripHint(forecast.home, forecast.campus, { leaveAt: trip.leaveAt, arriveAt: trip.classAt, doneAt, backAt })
  }, [trip, forecast, agenda, courses.items, minutes])
  if (!trip) return null

  const left = Math.ceil((trip.leaveAt.getTime() - now.getTime()) / 60_000)
  const late = left <= 0
  const soon = !late && left <= 60 && !trip.tomorrow
  const headline = trip.tomorrow
    ? `Tomorrow, leave by ${fmt.time.format(trip.leaveAt)}`
    : late
      ? 'Leave now'
      : soon
        ? `Leave in ${inWords(left)}`
        : `Leave by ${fmt.time.format(trip.leaveAt)}`
  const detail = late
    ? `${inWords(-left)} later than usual. ${trip.title} starts at ${fmt.time.format(trip.classAt)}.`
    : `${trip.train ? `Take the ${fmt.time.format(trip.train)} suburban · ` : ''}${trip.title} at ${fmt.time.format(trip.classAt)}`

  return (
    <button
      onClick={() => openEditor({ type: 'settings', section: 'commute' })}
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
        <TrainFront className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-headline tabular-nums', late ? 'text-danger' : 'text-ink')}>{headline}</span>
        <span className="block text-subhead text-muted">{detail}</span>
        {hint && <WeatherHint hint={hint} />}
        <span className="mt-0.5 block truncate text-caption text-faint">
          {trip.train
            ? `Metro to Doukissis Plakentias (about ${inWords(TO_TRAIN)}) · suburban to Pentelis · ${CAMPUS.split(',')[0]}`
            : `About ${inWords(minutes)} · ${COMMUTE_ROUTE}`}
        </span>
      </span>
    </button>
  )
}
