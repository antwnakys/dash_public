import { GraduationCap, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { RevealItem } from '@/components/ui/Reveal'
import { Card, Section } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { isClass, normalize, schoolLabel } from '@/lib/school'
import { courseOf } from '@/lib/courseLink'
import { formatMeetings, meetingsFromEvents } from '@/lib/schedule'
import type { CalendarEvent, Course } from '@/types'
import { t } from '@/i18n'

type Draft = Omit<Course, 'id'>

/**
 * Classes in the calendar at your school (the saved address) that aren't courses yet,
 * each ready to add with its weekly times worked out from the calendar.
 */
function useSchoolClasses(): Draft[] {
  const { calendar, events, courses, profile } = useDashboard()
  return useMemo(() => {
    const byTitle = new Map<string, CalendarEvent[]>()
    for (const e of [...calendar.events, ...events.items]) {
      if (!isClass(e, profile.school) || courseOf(e, courses.items)) continue
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
          // Follow these events from now on: renaming them in the calendar renames the course.
          calendarSeries: [...new Set(list.map((e) => e.series).filter((x): x is string => Boolean(x)))].slice(-30),
          calendarTitle: list[0].title,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [calendar.events, events.items, courses.items, profile.school])
}

export function SchoolClasses() {
  const { courses, notify, profile } = useDashboard()
  const found = useSchoolClasses()
  if (!found.length) return null

  const add = (list: Draft[]) => {
    list.forEach((c) => courses.add(c))
    notify(list.length === 1 ? t('sc.added', { name: list[0].name }) : t('sc.addedMany', { n: list.length }))
  }

  return (
    <RevealItem className="mb-8">
    <Section
      title={t('sc.title')}
      action={
        found.length > 1 && (
          <Button variant="plain" size="sm" onClick={() => add(found)}>
            {t('sc.addAll')}
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
              <Button size="sm" onClick={() => add([c])} aria-label={t('sc.addOne', { name: c.name })}>
                <Plus aria-hidden className="size-3.5" strokeWidth={2.4} />
                {t('sc.add')}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <p className="px-1 text-caption text-faint">{t('sc.footer', { school: schoolLabel(profile.school) })}</p>
    </Section>
    </RevealItem>
  )
}
