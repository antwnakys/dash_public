import { useMemo } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { examsAwaitingResult, sessionsFor, upcomingExams, type Exam, type SessionView } from '@/lib/exams'

export interface ExamWithPlan extends Exam {
  sessions: SessionView[]
  done: number
  /** The next session that isn't done and hasn't ended. */
  next?: SessionView
}

/** Upcoming exams with their study sessions, soonest first. */
export function useExams(now: Date): ExamWithPlan[] {
  const { agenda, calendar, events, study, examResults } = useDashboard()
  return useMemo(() => {
    const all = [...calendar.events, ...events.items]
    return upcomingExams(agenda, now, examResults.items).map((exam) => {
      const sessions = sessionsFor(exam, all, study.items)
      return {
        ...exam,
        sessions,
        done: sessions.filter((s) => s.done).length,
        next: sessions.find((s) => !s.done && s.end > now),
      }
    })
  }, [agenda, calendar.events, events.items, study.items, examResults.items, now])
}

/** Exams that are over and still need a result. */
export function useExamsAwaitingResult(now: Date): Exam[] {
  const { agenda, examResults } = useDashboard()
  return useMemo(() => examsAwaitingResult(agenda, now, examResults.items), [agenda, examResults.items, now])
}
