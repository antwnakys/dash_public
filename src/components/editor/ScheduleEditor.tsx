import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { WEEK, dayName, formatDate, formatTime, newMeeting, shiftEnd } from '@/lib/schedule'
import type { Course, CourseMeeting } from '@/types'
import { PickerPill } from './fields'
import { t } from '@/i18n'

type Term = NonNullable<Course['term']>

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-1.5">
      <span className="text-body text-ink">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

/** Weekly class times and term dates, laid out like an event in iOS Calendar. */
export function ScheduleEditor({
  meetings,
  onMeetings,
  term,
  onTerm,
}: {
  meetings: CourseMeeting[]
  onMeetings: (m: CourseMeeting[]) => void
  term: Term
  onTerm: (t: Term) => void
}) {
  const change = (i: number, m: CourseMeeting) => onMeetings(meetings.map((x, j) => (j === i ? m : x)))
  const toggle = (i: number, day: number) => {
    const m = meetings[i]
    change(i, { ...m, days: m.days.includes(day) ? m.days.filter((d) => d !== day) : [...m.days, day] })
  }

  return (
    <div className="flex flex-col gap-3">
      {meetings.map((m, i) => (
        <div key={i} className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
          <div className="flex items-center gap-1.5 px-3 py-3" role="group" aria-label={t('se.days')}>
            {WEEK.map((day) => {
              const on = m.days.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={dayName.long(day)}
                  onClick={() => toggle(i, day)}
                  className={cn(
                    'flex aspect-square min-w-0 flex-1 items-center justify-center rounded-full text-subhead font-semibold transition-[background-color,color,transform] duration-150 active:scale-90 sm:max-w-10',
                    on ? 'bg-accent-fill text-accent-ink' : 'bg-fill text-ink hover:bg-fill-strong',
                  )}
                >
                  {dayName.narrow(day)}
                </button>
              )
            })}
            {meetings.length > 1 && (
              <button
                type="button"
                aria-label={t('se.removeTime')}
                onClick={() => onMeetings(meetings.filter((_, j) => j !== i))}
                className="ms-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-transform active:scale-90"
              >
                <Minus aria-hidden className="size-4" strokeWidth={3} />
              </button>
            )}
          </div>
          <Row label={t('se.starts')}>
            <PickerPill type="time" label={t('se.classStarts')} value={m.start} display={formatTime} onChange={(v) => v && change(i, shiftEnd(m, v))} />
          </Row>
          <Row label={t('se.ends')}>
            <PickerPill
              type="time"
              label={t('se.classEnds')}
              value={m.end ?? ''}
              display={formatTime}
              onChange={(v) => change(i, { ...m, end: v || undefined })}
            />
          </Row>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onMeetings([...meetings, newMeeting()])}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-2 text-subhead font-medium text-accent transition-colors hover:bg-fill"
      >
        <Plus aria-hidden className="size-4" strokeWidth={2.4} />
        {t('se.addTime')}
      </button>

      <div className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
        <Row label={t('se.firstClass')}>
          <PickerPill type="date" label={t('se.firstClass')} value={term.start ?? ''} display={formatDate} onChange={(v) => onTerm({ ...term, start: v || undefined })} />
        </Row>
        <Row label={t('se.lastClass')}>
          <PickerPill type="date" label={t('se.lastClass')} value={term.end ?? ''} display={formatDate} onChange={(v) => onTerm({ ...term, end: v || undefined })} />
        </Row>
      </div>
    </div>
  )
}
