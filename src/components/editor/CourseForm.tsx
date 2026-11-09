import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { average, formatGrade, onScale, SCALE } from '@/lib/grades'
import { formatMeetings, newMeeting, parseSchedule } from '@/lib/schedule'
import type { Assignment, Course, CourseLink, CourseMeeting } from '@/types'
import { Field, TextInput } from './fields'
import { ScheduleEditor } from './ScheduleEditor'
import { locale, t } from '@/i18n'

/** Saved times, or ones read from an older free-text schedule, or one empty time to fill in. */
function initialMeetings(c?: Course): CourseMeeting[] {
  if (c?.meetings?.length) return c.meetings
  const parsed = c?.schedule ? parseSchedule(c.schedule) : []
  return parsed.length ? parsed : [newMeeting()]
}

const linkUrl = (c: Course | undefined, kind: CourseLink['kind']) => c?.links.find((l) => l.kind === kind)?.url ?? ''

const dueFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })

/** Everything due for this course, with grades; tap one to grade or edit it. */
function WorkAndGrades({ courseId, list, onOpen }: { courseId: string; list: Assignment[]; onOpen: (id: string) => void }) {
  const now = useNow(60_000)
  const work = list.filter((a) => a.courseId === courseId).sort((a, b) => a.due.localeCompare(b.due))
  if (!work.length) return null
  const avg = average(work)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-1 text-subhead font-medium text-muted">
        {t('cf.work')}{avg && t('cf.average', { avg: formatGrade(avg.value), scale: SCALE })}
      </span>
      <ul className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
        {work.map((a) => {
          const g = onScale(a)
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onOpen(a.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-fill"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{a.title}</span>
                  <span className="block text-caption text-muted">
                    {dueFmt.format(new Date(a.due))} · {a.kind === 'assignment' ? t('df.assignment') : a.kind === 'exam' ? t('df.exam') : t('df.quiz')}
                    {a.submitted && g == null && ' · done'}
                  </span>
                </span>
                <span className={g == null ? 'text-subhead text-accent' : 'text-body font-semibold text-ink tabular-nums'}>
                  {g == null ? (a.submitted || new Date(a.due) < now ? t('cf.addGrade') : '') : `${formatGrade(a.grade!)}/${a.outOf ?? SCALE}`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function CourseForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { courses, assignments, notify, openEditor } = useDashboard()
  const existing = courses.items.find((c) => c.id === id)

  const [code, setCode] = useState(existing?.code ?? '')
  const [name, setName] = useState(existing?.name ?? '')
  const [instructor, setInstructor] = useState(existing?.instructor ?? '')
  const [meetings, setMeetings] = useState(() => initialMeetings(existing))
  const [term, setTerm] = useState<NonNullable<Course['term']>>(existing?.term ?? {})
  const [progress, setProgress] = useState(Math.round((existing?.progress ?? 0) * 100))
  const [portal, setPortal] = useState(linkUrl(existing, 'portal'))
  const [materials, setMaterials] = useState(linkUrl(existing, 'materials'))
  const [meeting, setMeeting] = useState(linkUrl(existing, 'meeting'))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const links: CourseLink[] = []
    if (portal.trim()) links.push({ label: t('cf.portalLabel'), url: portal.trim(), kind: 'portal' })
    if (materials.trim()) links.push({ label: t('cf.materialsLabel'), url: materials.trim(), kind: 'materials' })
    if (meeting.trim()) links.push({ label: t('cf.onlineLabel'), url: meeting.trim(), kind: 'meeting' })
    // Keep links of other kinds (e.g. recorded lectures) that this form doesn't edit.
    links.push(...(existing?.links ?? []).filter((l) => l.kind === 'video'))
    const set = meetings.filter((m) => m.days.length)
    const data = {
      code: code.trim(),
      name: name.trim(),
      instructor: instructor.trim(),
      // No days picked keeps whatever schedule text an older version saved.
      schedule: set.length ? formatMeetings(set) : (existing?.meetings?.length ? '' : (existing?.schedule ?? '')),
      meetings: set.length ? set : undefined,
      term: term.start || term.end ? term : undefined,
      progress: progress / 100,
      links,
    }
    if (existing) courses.update(existing.id, data)
    else courses.add(data)
    notify(existing ? t('cf.saved') : t('cf.added'))
    onDone()
  }

  const remove = () => {
    if (!existing || !confirm(t('cf.confirmDelete', { name: existing.name }))) return
    assignments.set((list) => list.filter((a) => a.courseId !== existing.id))
    courses.remove(existing.id)
    notify(t('cf.deleted'))
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <Field label={t('cf.code')}>
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS 310" />
        </Field>
        <Field label={t('cf.name')}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t('cf.namePh')} required autoFocus={!existing} />
        </Field>
      </div>
      <Field label={t('cf.instructor')}>
        <TextInput value={instructor} onChange={(e) => setInstructor(e.target.value)} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-subhead font-medium text-muted">{t('cf.classTimes')}</span>
        <ScheduleEditor meetings={meetings} onMeetings={setMeetings} term={term} onTerm={setTerm} />
      </div>
      <Field label={t('cf.progress', { pct: progress })}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => setProgress(+e.target.value)}
          className="h-6 w-full accent-[var(--accent-fill)]"
        />
      </Field>
      {existing && <WorkAndGrades courseId={existing.id} list={assignments.items} onOpen={(id) => openEditor({ type: 'deadline', id })} />}
      <Field label={t('cf.portal')}>
        <TextInput type="url" inputMode="url" value={portal} onChange={(e) => setPortal(e.target.value)} placeholder="https://" />
      </Field>
      <Field label={t('cf.online')} hint={t('cf.onlineHint')}>
        <TextInput type="url" inputMode="url" value={meeting} onChange={(e) => setMeeting(e.target.value)} placeholder="https://" />
      </Field>
      <Field label={t('cf.materials')}>
        <TextInput type="url" inputMode="url" value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="https://" />
      </Field>
      <div className="mt-1 flex items-center gap-2">
        {existing && (
          <Button variant="danger" onClick={remove}>
            {t('common.delete')}
          </Button>
        )}
        <Button type="submit" variant="primary" className="ml-auto min-w-28">
          {existing ? t('cf.save') : t('cf.add')}
        </Button>
      </div>
    </form>
  )
}
