import { GraduationCap, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { RevealItem } from '@/components/ui/Reveal'
import { Card, Section } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { CAMPUS, isClass, matchCourse, normalize } from '@/lib/campus'
import { formatMeetings, meetingsFromEvents } from '@/lib/schedule'
import type { CalendarEvent, Course } from '@/types'

type Draft = Omit<Course, 'id'>

/**
 * Classes in the calendar at campus (Sorou 74, Marousi) that aren't courses yet,
 * each ready to add with its weekly times worked out from the calendar.
 */
function useCampusClasses(): Draft[] {
  const { calendar, events, courses } = useDashboard()
  return useMemo(() => {
    const byTitle = new Map<string, CalendarEvent[]>()
    for (const e of [...calendar.events, ...events.items]) {
      if (!isClass(e) || matchCourse(e.title, courses.items)) continue
      const key = normalize(e.title)
      byTitle.set(key, [...(byTitle.get(key) ?? []), e])
    }
    return [...byTitle.values()]
      .map((list) => {
        const meetings = meetingsFromEvents(list)
        return {
          code: '',
          name: list[0].title,
          instructor: '',
          progress: 0,
          schedule: formatMeetings(meetings),
          meetings,
          links: [],
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [calendar.events, events.items, courses.items])
}

export function CampusClasses() {
  const { courses, notify } = useDashboard()
  const found = useCampusClasses()
  if (!found.length) return null

  const add = (list: Draft[]) => {
    list.forEach((c) => courses.add(c))
    notify(list.length === 1 ? `${list[0].name} added to courses` : `${list.length} courses added`)
  }

  return (
    <RevealItem className="mb-8">
    <Section
      title="From your calendar"
      action={
        found.length > 1 && (
          <Button variant="plain" size="sm" onClick={() => add(found)}>
            Add all
          </Button>
        )
      }
    >
      <Card>
        <ul className="separated">
          {found.map((c) => (
            <li key={c.name} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-course/14 text-course">
                <GraduationCap aria-hidden className="size-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{c.name}</span>
                {c.schedule && <span className="block truncate text-subhead text-muted">{c.schedule}</span>}
              </span>
              <Button size="sm" onClick={() => add([c])} aria-label={`Add ${c.name} to courses`}>
                <Plus aria-hidden className="size-3.5" strokeWidth={2.4} />
                Add
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <p className="px-1 text-caption text-faint">Classes at {CAMPUS} that aren’t in your courses yet.</p>
    </Section>
    </RevealItem>
  )
}
