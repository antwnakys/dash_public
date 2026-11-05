import { useMemo } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { sessionsFor, upcomingExams, type Exam, type SessionView } from '@/lib/exams'

export interface ExamWithPlan extends Exam {
  sessions: SessionView[]
  done: number
  /** The next session that isn't done and hasn't ended. */
  next?: SessionView
}

/** Upcoming exams with their study sessions, soonest first. */
export function useExams(now: Date): ExamWithPlan[] {
  const { agenda, calendar, events, study } = useDashboard()
  return useMemo(() => {
    const all = [...calendar.events, ...events.items]
    return upcomingExams(agenda, now).map((exam) => {
      const sessions = sessionsFor(exam, all, study.items)
      return {
        ...exam,
        sessions,
        done: sessions.filter((s) => s.done).length,
        next: sessions.find((s) => !s.done && s.end > now),
      }
    })
  }, [agenda, calendar.events, events.items, study.items, now])
}
