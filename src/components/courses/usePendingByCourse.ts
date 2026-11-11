import { useMemo } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import type { Assignment } from '@/types'

/** Unsubmitted work per course id, oldest first, so overdue work leads until it is marked handed in. */
export function usePendingByCourse(): Map<string, Assignment[]> {
  const { courses, assignments } = useDashboard()
  return useMemo(() => {
    const open = assignments.items
      // Overdue work stays listed (first, oldest first) until it's marked handed in.
      .filter((a) => !a.submitted)
      .sort((a, b) => a.due.localeCompare(b.due))
    return new Map(courses.items.map((c) => [c.id, open.filter((a) => a.courseId === c.id)]))
  }, [courses.items, assignments.items])
}
