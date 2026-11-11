import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { JoinButton } from '@/components/ui/JoinButton'
import { Card, Section } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { classesOn } from '@/lib/classes'
import { cn } from '@/lib/cn'
import { courseTint } from '@/lib/courseColor'
import { addDays, fmt, isSameDay, startOfDay, weekOf } from '@/lib/date'
import { schoolLabel } from '@/lib/school'
import { locale, t, tn } from '@/i18n'

const dayRange = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })

/** The week's classes, Monday to Sunday, from the calendar and the courses' weekly times. */
export function Timetable() {
  const { agenda, courses, openEditor, profile } = useDashboard()
  const now = useNow(60_000)
  const [offset, setOffset] = useState(0)
  const days = useMemo(() => weekOf(addDays(now, offset * 7)), [now, offset])
  const week = useMemo(() => days.map((d) => ({ day: d, classes: classesOn(d, agenda, courses.items) })), [days, agenda, courses.items])
  const total = week.reduce((n, d) => n + d.classes.length, 0)
  const label = offset === 0 ? t('tt.thisWeek') : offset === 1 ? t('tt.nextWeek') : offset === -1 ? t('tt.lastWeek') : `${dayRange.format(days[0])} – ${dayRange.format(days[6])}`

  return (
    <Section
      title={t('tt.title')}
      meta={`${label} · ${tn('tt.classes', total)}`}
      action={
        <>
          {offset !== 0 && (
            <Button variant="plain" size="sm" onClick={() => setOffset(0)}>
              {t('tt.thisWeek')}
            </Button>
          )}
          <IconButton icon={ChevronLeft} label={t('cal.prevWeek')} onClick={() => setOffset((o) => o - 1)} />
          <IconButton icon={ChevronRight} label={t('cal.nextWeek')} onClick={() => setOffset((o) => o + 1)} />
        </>
      }
    >
      <Card>
        {total === 0 ? (
          <p className="px-4 py-6 text-center text-subhead text-muted">
            {profile.school?.address ? t('tt.emptySchool', { school: schoolLabel(profile.school) }) : t('tt.emptyNoSchool')}
          </p>
        ) : (
          <ol className="separated">
            {week
              // Weekdays without classes say so, except days of this week that are already over.
              .filter((d) => d.classes.length || (d.day.getDay() >= 1 && d.day.getDay() <= 5 && !(offset === 0 && d.day < startOfDay(now))))
              .map(({ day, classes }) => {
                const today = isSameDay(day, now)
                return (
                  <li key={day.toDateString()} className={cn('flex gap-3 px-4 py-3', today && 'bg-accent/6')}>
                    <div className="w-12 shrink-0 pt-0.5">
                      <div className={cn('text-subhead font-semibold', today ? 'text-accent' : 'text-ink')}>{fmt.weekdayShort.format(day)}</div>
                      <div className="text-caption text-muted tabular-nums">{day.getDate()}</div>
                    </div>
                    {classes.length === 0 ? (
                      <p className="pt-0.5 text-subhead text-faint">{t('tt.noClasses')}</p>
                    ) : (
                      <ul className="flex min-w-0 flex-1 flex-col gap-2">
                        {classes.map((c) => {
                          const past = (c.end ?? c.start) < now
                          return (
                            <li key={`${c.start.getTime()}-${c.title}`} className="flex items-center gap-2">
                              <button
                                disabled={!c.courseId}
                                onClick={() => c.courseId && openEditor({ type: 'course', id: c.courseId })}
                                style={courseTint(courses.items, c.courseId, 8)}
                                className={cn(
                                  'flex min-w-0 flex-1 items-start gap-3 rounded-[0.6rem] border-s-[3px] border-course bg-course/8 px-3 py-2 text-start transition-colors enabled:hover:bg-course/14',
                                  past && 'opacity-55',
                                )}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-body font-medium text-ink">{c.title}</span>
                                  <span className="block text-caption text-muted tabular-nums">
                                    {[`${fmt.time.format(c.start)}${c.end ? `–${fmt.time.format(c.end)}` : ''}`, c.code, c.online && t('tt.online')]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                </span>
                              </button>
                              {c.online && c.link && !past && <JoinButton url={c.link} compact />}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}
          </ol>
        )}
      </Card>
    </Section>
  )
}
