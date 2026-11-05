import { useMemo } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import type { Assignment } from '@/types'

/** Unsubmitted future work per course id, soonest first. */
export function usePendingByCourse(now: Date): Map<string, Assignment[]> {
  const { courses, assignments } = useDashboard()
  return useMemo(() => {
    const open = assignments.items
      .filter((a) => !a.submitted && new Date(a.due) > now)
      .sort((a, b) => a.due.localeCompare(b.due))
    return new Map(courses.items.map((c) => [c.id, open.filter((a) => a.courseId === c.id)]))
  }, [courses.items, assignments.items, now])
}
