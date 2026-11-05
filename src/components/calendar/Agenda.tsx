import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Countdown } from '@/components/ui/Countdown'
import { JoinButton } from '@/components/ui/JoinButton'
import { LinkButton } from '@/components/ui/LinkButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { Card, Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { kindLabel } from '@/lib/agenda'
import { cn } from '@/lib/cn'
import { dayDiff, fmt, isSameDay, startOfDay } from '@/lib/date'
import type { AgendaItem } from '@/types'

function dayHeading(d: Date, now: Date): string {
  const diff = dayDiff(now, d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return fmt.shortDate.format(d)
}

function Row({ item, now }: { item: AgendaItem; now: Date }) {
  const { openEditor } = useDashboard()
  const flagged = item.kind === 'exam' || item.kind === 'quiz'
  const isClass = item.kind === 'class'
  // Synced calendar entries are edited in Google Calendar; a class opens its course instead.
  const target =
    item.source === 'assignment'
      ? ({ type: 'deadline', id: item.id } as const)
      : item.source === 'event'
        ? item.kind === 'exam'
          ? ({ type: 'exam', id: item.id } as const)
          : ({ type: 'event', id: item.id } as const)
        : item.source === 'task'
          ? ({ type: 'task', id: item.id } as const)
        : item.courseId
          ? ({ type: 'course', id: item.courseId } as const)
          : null
  return (
    <li className="flex items-center">
      <button
        disabled={!target}
        onClick={() => target && openEditor(target)}
        className="flex min-h-[3.25rem] w-full min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left transition-colors enabled:hover:bg-fill enabled:active:bg-fill-strong"
      >
        <span
          className={cn(
            'w-12 shrink-0 text-subhead tabular-nums',
            flagged ? 'font-semibold text-accent' : isClass ? 'font-semibold text-course' : 'text-muted',
          )}
        >
          {item.allDay ? 'All day' : fmt.time.format(item.date)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-body text-ink">
              <span className="sr-only">{kindLabel[item.kind]}: </span>
              {item.title}
            </span>
            {flagged && (
              <span aria-hidden className="shrink-0 rounded-[0.35rem] bg-accent/12 px-1.5 py-px text-caption font-semibold text-accent">
                {kindLabel[item.kind]}
              </span>
            )}
            {isClass && (
              <span aria-hidden className="shrink-0 rounded-[0.35rem] bg-course/14 px-1.5 py-px text-caption font-semibold text-course">
                {kindLabel.class}
              </span>
            )}
          </span>
          {item.context && <span className="block truncate text-subhead text-muted">{item.context}</span>}
        </span>
        <Countdown date={item.date} now={now} />
      </button>
      {item.online && item.link && <JoinButton url={item.link} compact className="mr-4" />}
      {item.kind === 'exam' && item.url && <LinkButton url={item.url} compact className="mr-4" />}
    </li>
  )
}

export function Agenda({ title = 'Up next', limit }: { title?: string; limit?: number }) {
  const { agenda, selectedDate, setSelectedDate, openEditor, calendar, notify } = useDashboard()
  const now = useNow(60_000)
  const viewingToday = isSameDay(selectedDate, now)

  const groups = useMemo(() => {
    const from = startOfDay(selectedDate)
    const upcoming = agenda.filter((i) => i.date >= from && (!isSameDay(i.date, now) || i.allDay || i.date >= now))
    const items = limit ? upcoming.slice(0, limit) : upcoming
    const byDay = new Map<string, { date: Date; items: AgendaItem[] }>()
    for (const item of items) {
      const k = startOfDay(item.date).toDateString()
      if (!byDay.has(k)) byDay.set(k, { date: startOfDay(item.date), items: [] })
      byDay.get(k)!.items.push(item)
    }
    return [...byDay.values()]
  }, [agenda, selectedDate, now, limit])

  const loading = calendar.status === 'syncing' && !calendar.syncedAt

  const connectGoogle = async () => {
    if (!calendar.google.available) return openEditor({ type: 'settings', section: 'calendar' })
    try {
      await calendar.google.connect()
      notify('Google Calendar connected')
    } catch (e) {
      notify(e instanceof Error && /cancel|closed/i.test(e.message) ? 'Sign-in cancelled' : 'Couldn’t connect to Google. Try again.', 'error')
    }
  }

  return (
    <Section
      title={title}
      meta={!viewingToday && `From ${fmt.shortDate.format(selectedDate)}`}
      action={
        <>
          {!viewingToday && (
            <Button variant="plain" size="sm" onClick={() => setSelectedDate(startOfDay(new Date()))}>
              Back to today
            </Button>
          )}
          {calendar.status !== 'off' && (
            <IconButton
              icon={RefreshCw}
              label={calendar.status === 'error' ? `Sync failed: ${calendar.error}` : 'Sync calendar'}
              onClick={calendar.sync}
              className={cn(calendar.status === 'syncing' && '[&>svg]:animate-spin', calendar.status === 'error' && 'text-danger')}
            />
          )}
        </>
      }
    >
      <Card>
        {(calendar.status === 'off' || calendar.status === 'reconnect') && (
          <button
            onClick={connectGoogle}
            disabled={calendar.google.connecting}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-fill"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
              <RefreshCw aria-hidden className="size-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-medium text-ink">
                {calendar.google.connecting
                  ? 'Waiting for Google…'
                  : calendar.status === 'reconnect'
                    ? 'Reconnect Google Calendar'
                    : 'Connect Google Calendar'}
              </span>
              <span className="block text-subhead text-muted">
                {calendar.status === 'reconnect' ? 'Google sign-in expired. Tap to sign in again.' : 'Sign in with Google to see your events here.'}
              </span>
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
          </button>
        )}
        {calendar.status === 'error' && (
          <p role="alert" className="border-b border-line px-4 py-2.5 text-subhead text-danger">
            Calendar sync failed. {calendar.error}
          </p>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selectedDate.toDateString()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {loading && (
              <div className="flex flex-col gap-3 p-4" aria-label="Loading events">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            )}
            {!loading && groups.length === 0 && (
              <div className={cn((calendar.status === 'off' || calendar.status === 'reconnect') && 'border-t border-line')}>
                <EmptyState message={viewingToday ? 'Nothing coming up. Enjoy the free time.' : 'Nothing scheduled from this day on.'}>
                  <Button variant="plain" size="sm" onClick={() => openEditor({ type: 'event' })}>
                    Add an event
                  </Button>
                </EmptyState>
              </div>
            )}
            {groups.map(({ date, items }, i) => (
              <div key={date.toDateString()} className={cn((i > 0 || calendar.status === 'off' || calendar.status === 'reconnect') && 'border-t border-line')}>
                <h3 className="px-4 pt-3 pb-0.5 text-subhead font-semibold text-ink">{dayHeading(date, now)}</h3>
                <ol className="separated">
                  {items.map((item) => (
                    <Row key={item.id} item={item} now={now} />
                  ))}
                </ol>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </Card>
    </Section>
  )
}
