import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Agenda } from '@/components/calendar/Agenda'
import { DayTimeline } from '@/components/calendar/DayTimeline'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { SemesterView } from '@/components/calendar/SemesterView'
import { WeekGrid } from '@/components/calendar/WeekGrid'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Reveal, RevealItem } from '@/components/ui/Reveal'
import { Segmented } from '@/components/ui/Segmented'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { addDays, fmt, isSameDay, startOfDay, weekOf } from '@/lib/date'
import { locale, t } from '@/i18n'
import { student } from '@/lib/role'

type Mode = 'month' | 'week' | 'day' | 'term'

const modes = [
  { value: 'day' as const, label: t('cal.day') },
  { value: 'week' as const, label: t('cal.week') },
  { value: 'month' as const, label: t('cal.month') },
  // The semester view (exams and deadlines by week) is for students.
  ...(student ? [{ value: 'term' as const, label: t('sem.label') }] : []),
]

// Remembered per device: a phone and a laptop often want different views.
const MODE_KEY = 'unidash.calendarMode.v1'
const savedMode = (): Mode => {
  try {
    const m = localStorage.getItem(MODE_KEY)
    return m === 'day' || m === 'week' || m === 'month' || (m === 'term' && student) ? m : 'week'
  } catch {
    return 'week'
  }
}

const rangeFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })

/** "9–15 Nov 2026" (or "Nov 9 – 15, 2026"), in the page's language. */
function weekTitle(days: Date[]): string {
  try {
    return rangeFmt.formatRange(days[0], days[6])
  } catch {
    return `${fmt.dayMonth.format(days[0])} – ${rangeFmt.format(days[6])}`
  }
}

export function CalendarView() {
  const { openEditor, calendar, selectedDate, setSelectedDate } = useDashboard()
  const now = useNow(60_000)
  const [mode, setModeState] = useState<Mode>(savedMode)
  const setMode = (m: Mode) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // Only a convenience.
    }
  }
  const days = weekOf(selectedDate)
  const step = (dir: 1 | -1) => setSelectedDate(addDays(selectedDate, dir * (mode === 'week' ? 7 : 1)))
  const onToday = mode === 'week' ? days.some((d) => isSameDay(d, now)) : isSameDay(selectedDate, now)
  // On right-to-left pages "back" points right.
  const rtl = document.documentElement.dir === 'rtl'

  // ← and → move by a day or a week (not while typing or with a sheet open).
  useEffect(() => {
    if (mode === 'month' || mode === 'term') return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest('input, textarea, select, [contenteditable], [role=dialog]')) return
      const back = rtl ? 'ArrowRight' : 'ArrowLeft'
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
      if (e.key === back) setSelectedDate(addDays(selectedDate, mode === 'week' ? -7 : -1))
      else if (e.key === forward) setSelectedDate(addDays(selectedDate, mode === 'week' ? 7 : 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, selectedDate, setSelectedDate, rtl])

  return (
    <Reveal id="calendar">
      <PageHeader
        shortTitle={t('cal.title')}
        eyebrow={calendar.google.account ? t('cal.syncedWith', { email: calendar.google.account.email }) : calendar.status === 'off' ? t('cal.notConnected') : t('cal.syncedIcal')}
        title={t('cal.title')}
        aside={
          <Button variant="primary" onClick={() => openEditor({ type: 'event' })}>
            <Plus aria-hidden className="size-4" strokeWidth={2.4} />
            {t('cal.addEvent')}
          </Button>
        }
      />
      <RevealItem className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented label={t('cal.view')} options={modes} value={mode} onChange={setMode} />
        {(mode === 'week' || mode === 'day') && (
          <div className="flex items-center gap-1">
            <span className="me-1 text-headline text-ink tabular-nums">{mode === 'week' ? weekTitle(days) : fmt.longDate.format(selectedDate)}</span>
            <Button variant="plain" size="sm" disabled={onToday} onClick={() => setSelectedDate(startOfDay(now))}>
              {t('cal.today')}
            </Button>
            <IconButton icon={ChevronLeft} label={mode === 'week' ? t('cal.prevWeek') : t('wk.prevDay')} onClick={() => step(-1)} />
            <IconButton icon={ChevronRight} label={mode === 'week' ? t('cal.nextWeek') : t('wk.nextDay')} onClick={() => step(1)} />
          </div>
        )}
      </RevealItem>
      {mode === 'week' && (
        <RevealItem>
          <WeekGrid days={days} now={now} />
          <p className="mt-2 hidden px-1 text-caption text-faint md:block">{t('wk.hint')}</p>
        </RevealItem>
      )}
      {mode === 'day' && (
        <RevealItem className="mx-auto max-w-[44rem]">
          <DayTimeline day={selectedDate} now={now} />
        </RevealItem>
      )}
      {mode === 'term' && (
        <RevealItem>
          <SemesterView
            now={now}
            onOpenWeek={(d) => {
              setSelectedDate(d)
              setMode('week')
            }}
          />
        </RevealItem>
      )}
      {mode === 'month' && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <RevealItem className="xl:sticky xl:top-8">
            <MiniCalendar large />
          </RevealItem>
          <RevealItem>
            <Agenda title={t('cal.schedule')} />
          </RevealItem>
        </div>
      )}
    </Reveal>
  )
}
