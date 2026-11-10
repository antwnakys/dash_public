import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, Square, X } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { useDashboard } from '@/context/DashboardContext'
import { fmtLeft } from '@/hooks/useFocusTimer'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/cn'
import { fmt, isSameDay } from '@/lib/date'
import { minutesOn, weekMinutes } from '@/lib/focusStats'
import { spring } from '@/lib/motion'
import { minutesLabel } from '@/lib/setup'
import { t } from '@/i18n'

// Wrapped in left-to-right isolates so "25 / 5" doesn't read "5 / 25" on right-to-left pages.
const presets = [
  { value: '25', label: '\u206625 / 5\u2069' },
  { value: '50', label: '\u206650 / 10\u2069' },
  { value: '90', label: '\u206690 / 15\u2069' },
] as const
const breakFor: Record<string, number> = { '25': 5, '50': 10, '90': 15 }

/**
 * Focus mode: a calm full-screen timer. Pick a length, optionally the task and course you're on, and start.
 * Today's and this week's study time sit underneath. The timer keeps going if you close this (a pill shows it).
 */
export function FocusMode() {
  const { focusOpen, setFocusOpen, focus, focusSessions, tasks, courses } = useDashboard()
  const now = useNow(60_000)
  const { state, left, running, active } = focus
  const total = (state.phase === 'focus' ? state.focusMin : state.breakMin) * 60_000
  const progress = 1 - left / total
  const today = minutesOn(focusSessions.items, now)
  const week = weekMinutes(focusSessions.items, now)
  const maxDay = Math.max(30, ...week.minutes)
  const openTasks = tasks.tasks.filter((x) => !x.done)
  const preset = String(state.focusMin) in breakFor ? String(state.focusMin) : 'custom'

  useEffect(() => {
    if (!focusOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusOpen(false)
      if (e.key === ' ' && !(e.target as HTMLElement).closest('input, select, textarea, button')) {
        e.preventDefault()
        if (running) focus.pause()
        else focus.start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusOpen, running, focus, setFocusOpen])

  const R = 120
  const C = 2 * Math.PI * R

  return (
    <AnimatePresence>
      {focusOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t('focus.title')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-bg"
        >
          <div className="mx-auto flex min-h-full max-w-[34rem] flex-col px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            <div className="flex items-center justify-between">
              <span className="text-caption font-semibold tracking-wide text-muted uppercase">{state.phase === 'focus' ? t('focus.focus') : t('focus.break')}</span>
              <button
                onClick={() => setFocusOpen(false)}
                aria-label={t('focus.close')}
                className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-fill hover:text-ink"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>

            <div className="relative mx-auto my-6 flex aspect-square w-full max-w-[18rem] items-center justify-center">
              <svg viewBox="0 0 260 260" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="130" cy="130" r={R} fill="none" stroke="var(--fill-strong)" strokeWidth="4" />
                <motion.circle
                  cx="130"
                  cy="130"
                  r={R}
                  fill="none"
                  stroke={state.phase === 'focus' ? 'var(--accent)' : 'var(--course)'}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  animate={{ strokeDashoffset: C * (1 - Math.min(1, Math.max(0, progress))) }}
                  transition={{ duration: 0.5, ease: 'linear' }}
                />
              </svg>
              <div className="text-center">
                <div dir="ltr" className="text-[4rem] leading-none font-extralight tracking-[-0.04em] text-ink tabular-nums">
                  {fmtLeft(left)}
                </div>
                <div className="mt-2 px-6 text-subhead text-muted">
                  {state.phase === 'break'
                    ? t('focus.breakHint')
                    : running
                      ? t('focus.runningHint')
                      : active
                        ? t('focus.paused')
                        : t('focus.lengths', { focus: minutesLabel(state.focusMin), rest: minutesLabel(state.breakMin) })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              {running ? (
                <Button variant="primary" onClick={focus.pause} className="min-w-32">
                  <Pause aria-hidden className="size-4" strokeWidth={2.4} />
                  {t('focus.pause')}
                </Button>
              ) : (
                <Button variant="primary" onClick={focus.start} className="min-w-32">
                  <Play aria-hidden className="size-4" strokeWidth={2.4} />
                  {active ? t('focus.resume') : state.phase === 'break' ? t('focus.startBreak') : t('focus.start')}
                </Button>
              )}
              {(active || running) && (
                <Button onClick={state.phase === 'break' ? focus.skipBreak : focus.stop}>
                  <Square aria-hidden className="size-3.5" strokeWidth={2.4} />
                  {state.phase === 'break' ? t('focus.skipBreak') : t('focus.stop')}
                </Button>
              )}
            </div>

            <div className={cn('mt-8 flex flex-col gap-4 transition-opacity', running && 'pointer-events-none opacity-50')}>
              <div className="flex flex-col gap-1.5">
                <span className="px-1 text-subhead font-medium text-muted">{t('focus.length')}</span>
                <div className="flex items-center gap-2">
                  <Segmented
                    label={t('focus.length')}
                    options={presets}
                    value={preset === 'custom' ? ('' as '25') : (preset as '25')}
                    onChange={(v) => focus.setDurations(Number(v), breakFor[v])}
                    className="flex-1"
                    block
                  />
                  <label className="flex h-8 items-center gap-1 rounded-[var(--radius-control)] bg-fill px-2 text-subhead text-muted">
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={state.focusMin}
                      onChange={(e) => {
                        const m = Math.min(180, Math.max(5, Number(e.target.value) || 25))
                        focus.setDurations(m, Math.max(3, Math.round(m / 5)))
                      }}
                      aria-label={t('focus.custom')}
                      className="w-11 bg-transparent text-end text-ink tabular-nums outline-none"
                    />
                    {t('focus.min')}
                  </label>
                </div>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="px-1 text-subhead font-medium text-muted">{t('focus.workingOn')}</span>
                <select
                  value={state.taskId ?? ''}
                  onChange={(e) => focus.setLinks({ taskId: e.target.value || undefined, courseId: state.courseId })}
                  className="h-11 w-full appearance-none rounded-[var(--radius-control)] bg-fill px-3.5 text-base text-ink outline-none sm:text-[0.9375rem]"
                >
                  <option value="">{t('focus.noTask')}</option>
                  {openTasks.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="px-1 text-subhead font-medium text-muted">{t('focus.course')}</span>
                <select
                  value={state.courseId ?? ''}
                  onChange={(e) => focus.setLinks({ taskId: state.taskId, courseId: e.target.value || undefined })}
                  className="h-11 w-full appearance-none rounded-[var(--radius-control)] bg-fill px-3.5 text-base text-ink outline-none sm:text-[0.9375rem]"
                >
                  <option value="">{t('focus.noCourse')}</option>
                  {courses.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="surface mt-8 px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="text-subhead text-muted">
                  {t('focus.today')} <span className="font-semibold text-ink tabular-nums">{minutesLabel(today)}</span>
                </span>
                <span className="text-subhead text-muted">
                  {t('focus.week')} <span className="font-semibold text-ink tabular-nums">{minutesLabel(week.total)}</span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1.5" aria-label={t('focus.perDay')}>
                {week.days.map((d, i) => (
                  <div key={d.toISOString()} className="flex flex-col items-center gap-1" title={`${fmt.weekday.format(d)}: ${minutesLabel(week.minutes[i])}`}>
                    <div className="flex h-14 w-full items-end rounded-[0.4rem] bg-fill">
                      <motion.div
                        className={cn('w-full rounded-[0.4rem]', isSameDay(d, now) ? 'bg-accent' : 'bg-ink/70')}
                        initial={false}
                        animate={{ height: week.minutes[i] ? `${Math.max(10, (week.minutes[i] / maxDay) * 100)}%` : 0 }}
                        transition={spring.smooth}
                      />
                    </div>
                    <span className={cn('text-caption', isSameDay(d, now) ? 'font-semibold text-accent' : 'text-muted')}>{fmt.weekdayNarrow.format(d)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-caption text-faint">{t('focus.footer')}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** While the timer runs and Focus is closed: a small pill to get back to it. */
export function FocusPill() {
  const { focus, focusOpen, setFocusOpen } = useDashboard()
  if (focusOpen || !(focus.running || focus.active)) return null
  return (
    <button
      onClick={() => setFocusOpen(true)}
      className="material fixed end-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5rem)] z-30 flex h-10 items-center gap-2 rounded-full px-3.5 text-subhead font-medium text-ink tabular-nums lg:end-6 lg:bottom-6"
      aria-label={t('focus.openTimer')}
    >
      <span className={cn('size-2 rounded-full', focus.running ? (focus.state.phase === 'focus' ? 'bg-accent' : 'bg-course') : 'bg-faint')} />
      {focus.state.phase === 'focus' ? t('focus.focus') : t('focus.break')} <span dir="ltr">{fmtLeft(focus.left)}</span>
    </button>
  )
}
