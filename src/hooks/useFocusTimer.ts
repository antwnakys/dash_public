import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelFocusAlert, chime, macBanner, scheduleFocusAlert } from '@/lib/focusNotify'
import { t } from '@/i18n'
import { fmt } from '@/lib/date'
import type { FocusSession } from '@/types'
import type { Collection } from './useCollection'
import { useLocalStorage } from './useLocalStorage'
import { minutesLabel } from '@/lib/setup'

export interface FocusTimerState {
  phase: 'focus' | 'break'
  /** When the running phase ends (ms); missing while paused or idle. */
  endsAt?: number
  /** Time left while paused (ms). */
  remaining: number
  focusMin: number
  breakMin: number
  taskId?: string
  courseId?: string
  /** When this focus phase began (ms), for partial sessions. */
  startedAt?: number
  /** Focus time already done in this phase before pauses (ms). */
  done: number
}

const IDLE = (focusMin = 25, breakMin = 5): FocusTimerState => ({ phase: 'focus', remaining: focusMin * 60_000, focusMin, breakMin, done: 0 })

export interface FocusTimer {
  state: FocusTimerState
  /** ms left in the current phase. */
  left: number
  running: boolean
  /** Started (running or paused mid-phase). */
  active: boolean
  start: () => void
  pause: () => void
  /** Ends the phase; a focus phase of 5 minutes or more is saved as a session. */
  stop: () => void
  skipBreak: () => void
  setDurations: (focusMin: number, breakMin: number) => void
  setLinks: (links: { taskId?: string; courseId?: string }) => void
}

const MIN_SAVED = 5 * 60_000

/**
 * Pomodoro-style timer that keeps running across tabs and reloads (state on this device), and saves finished focus
 * time to the synced `unidash.focus.v1` collection. A finished focus phase chimes, notifies, and starts the break;
 * a finished break chimes and waits for you.
 */
export function useFocusTimer(sessions: Collection<FocusSession>, notify: (m: string) => void): FocusTimer {
  const [stored, setStored] = useLocalStorage<FocusTimerState>('unidash.focusTimer.v1')
  const state = stored ?? IDLE()
  const [now, setNow] = useState(() => Date.now())
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  const running = state.endsAt !== undefined
  const left = running ? Math.max(0, state.endsAt! - now) : state.remaining
  const active = running || state.remaining < (state.phase === 'focus' ? state.focusMin : state.breakMin) * 60_000

  const save = useCallback(
    (s: FocusTimerState, ms: number) => {
      if (ms < MIN_SAVED) return
      sessions.add({ start: new Date(s.startedAt ?? Date.now() - ms).toISOString(), minutes: Math.round(ms / 60_000), taskId: s.taskId, courseId: s.courseId })
    },
    [sessions],
  )

  // Tick while running; finish phases on time even if the page was in the background.
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [running])

  useEffect(() => {
    const s = stateRef.current
    if (s.endsAt === undefined || now < s.endsAt) return
    chime()
    if (s.phase === 'focus') {
      save(s, s.done + (s.endsAt - (s.startedAt ?? s.endsAt)))
      const endsAt = s.endsAt + s.breakMin * 60_000
      setStored({ ...s, phase: 'break', endsAt, remaining: s.breakMin * 60_000, startedAt: undefined, done: 0 })
      notify(t('focus.doneToast', { min: minutesLabel(s.focusMin), time: fmt.time.format(new Date(endsAt)) }))
      void macBanner(t('focus.breakTitle'), t('focus.breakBody', { min: minutesLabel(s.focusMin) }))
      void scheduleFocusAlert(new Date(endsAt), t('focus.overTitle'), t('focus.overBody'))
    } else {
      setStored({ ...IDLE(s.focusMin, s.breakMin), taskId: s.taskId, courseId: s.courseId })
      notify(t('focus.overToast'))
      void macBanner(t('focus.overTitle'), t('focus.overBody'))
    }
  }, [now, save, setStored, notify])

  useEffect(() => {
    document.title = running ? `${fmtLeft(left)} · ${state.phase === 'focus' ? t('focus.focus') : t('focus.break')} · unidash` : 'unidash'
  }, [running, left, state.phase])

  const start = useCallback(() => {
    const s = stateRef.current
    const at = Date.now()
    const endsAt = at + s.remaining
    setStored({ ...s, endsAt, startedAt: s.phase === 'focus' ? (s.startedAt ?? at) : undefined })
    setNow(at)
    void scheduleFocusAlert(
      new Date(endsAt),
      s.phase === 'focus' ? t('focus.breakTitle') : t('focus.overTitle'),
      s.phase === 'focus' ? t('focus.breakBody', { min: minutesLabel(s.focusMin) }) : t('focus.overBody'),
    )
  }, [setStored])

  const pause = useCallback(() => {
    const s = stateRef.current
    if (s.endsAt === undefined) return
    const at = Date.now()
    const remaining = Math.max(0, s.endsAt - at)
    const ran = s.phase === 'focus' && s.startedAt ? at - s.startedAt : 0
    setStored({ ...s, endsAt: undefined, remaining, done: s.done + ran, startedAt: undefined })
    void cancelFocusAlert()
  }, [setStored])

  const stop = useCallback(() => {
    const s = stateRef.current
    if (s.phase === 'focus') {
      const ms = s.done + (s.endsAt !== undefined && s.startedAt ? Date.now() - s.startedAt : 0)
      save({ ...s, startedAt: s.startedAt ?? Date.now() - ms }, ms)
      if (ms >= MIN_SAVED) notify(t('focus.saved', { min: minutesLabel(Math.round(ms / 60_000)) }))
    }
    setStored({ ...IDLE(s.focusMin, s.breakMin), taskId: s.taskId, courseId: s.courseId })
    void cancelFocusAlert()
  }, [save, setStored, notify])

  const skipBreak = useCallback(() => {
    const s = stateRef.current
    setStored({ ...IDLE(s.focusMin, s.breakMin), taskId: s.taskId, courseId: s.courseId })
    void cancelFocusAlert()
  }, [setStored])

  const setDurations = useCallback(
    (focusMin: number, breakMin: number) => {
      const s = stateRef.current
      if (s.endsAt !== undefined) return
      setStored({ ...s, focusMin, breakMin, remaining: (s.phase === 'focus' ? focusMin : breakMin) * 60_000, done: 0 })
    },
    [setStored],
  )

  const setLinks = useCallback((links: { taskId?: string; courseId?: string }) => setStored({ ...stateRef.current, ...links }), [setStored])

  return { state, left, running, active, start, pause, stop, skipBreak, setDurations, setLinks }
}

export const fmtLeft = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
