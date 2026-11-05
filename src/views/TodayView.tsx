import { Agenda } from '@/components/calendar/Agenda'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { AppExpiryCard } from '@/components/commute/AppExpiryCard'
import { LeaveCard, OnlineCard } from '@/components/commute/LeaveCard'
import { NextExamCard } from '@/components/exams/NextExamCard'
import { MetroCardCard } from '@/components/commute/MetroCardCard'
import { RemindersPrompt } from '@/components/commute/RemindersPrompt'
import { CourseList } from '@/components/courses/CourseList'
import { WeatherChip } from '@/components/header/WeatherChip'
import { PageHeader } from '@/components/layout/PageHeader'
import { TaskList } from '@/components/tasks/TaskList'
import { Reveal, RevealItem } from '@/components/ui/Reveal'
import { RollingTime } from '@/components/ui/RollingTime'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { countdown, fmt, greeting, isSameDay } from '@/lib/date'

/** One calm sentence about the day, built from what's actually scheduled. */
function useSummary(now: Date) {
  const { agenda, tasks } = useDashboard()
  const leftToday = agenda.filter((i) => isSameDay(i.date, now) && (i.allDay || i.date >= now)).length
  const open = tasks.tasks.filter((t) => !t.done).length
  const deadline = agenda.find((i) => (i.kind === 'assignment' || i.kind === 'exam' || i.kind === 'quiz' || i.kind === 'task') && i.date > now)

  const first = leftToday === 0 ? 'Nothing else on today' : `${leftToday} more ${leftToday === 1 ? 'thing' : 'things'} today`
  const second = open === 0 ? 'no open tasks' : `${open} open ${open === 1 ? 'task' : 'tasks'}`
  return (
    <>
      {first}, {second}.
      {deadline && (
        <>
          {' '}
          Next due: <span className="text-ink">{deadline.title}</span>, {countdown(deadline.date, now)}.
        </>
      )}
    </>
  )
}

function Clock({ now }: { now: Date }) {
  return (
    <time dateTime={now.toISOString()} className="block text-[2.75rem] leading-none font-extralight tracking-[-0.03em] text-muted tabular-nums">
      <RollingTime text={fmt.time.format(now)} />
    </time>
  )
}

export function TodayView() {
  const { profile } = useDashboard()
  const now = useNow(1000)
  const summary = useSummary(now)

  return (
    <Reveal id="today">
      <PageHeader
        shortTitle="Today"
        eyebrow={fmt.longDate.format(now)}
        accessory={<WeatherChip />}
        title={
          <>
            {greeting(now)}
            {profile.name && `, ${profile.name}`}
          </>
        }
        aside={<Clock now={now} />}
        summary={summary}
      />

      {/* One column in priority order until 1280px, then two. */}
      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] xl:items-start xl:gap-x-8 xl:gap-y-0">
        <div className="contents xl:flex xl:flex-col xl:gap-8">
          <RevealItem className="order-0 flex flex-col gap-3 empty:hidden">
            <AppExpiryCard />
            <RemindersPrompt />
            <MetroCardCard />
            <OnlineCard />
            <LeaveCard />
            <NextExamCard />
          </RevealItem>
          <RevealItem className="order-1">
            <Agenda limit={6} />
          </RevealItem>
          <RevealItem className="order-2">
            <TaskList />
          </RevealItem>
        </div>
        <div className="contents xl:flex xl:flex-col xl:gap-8">
          <RevealItem className="order-4 xl:order-none">
            <MiniCalendar />
          </RevealItem>
          <RevealItem className="order-3 xl:order-none">
            <CourseList />
          </RevealItem>
        </div>
      </div>
    </Reveal>
  )
}
