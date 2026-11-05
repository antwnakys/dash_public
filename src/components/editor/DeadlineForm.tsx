import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { useDashboard } from '@/context/DashboardContext'
import type { Assignment } from '@/types'
import { SCALE } from '@/lib/grades'
import { localInput } from '@/lib/localInput'
import { Field, Select, TextInput, Toggle } from './fields'

const kinds = [
  { value: 'assignment' as const, label: 'Assignment' },
  { value: 'quiz' as const, label: 'Quiz' },
  { value: 'exam' as const, label: 'Exam' },
]

/** Default due time: the selected day at 23:59, or tomorrow when today is selected. */
function defaultDue(selected: Date): string {
  const d = new Date(selected)
  if (d.toDateString() === new Date().toDateString()) d.setDate(d.getDate() + 1)
  d.setHours(23, 59, 0, 0)
  return d.toISOString()
}

export function DeadlineForm({ id, courseId, onDone }: { id?: string; courseId?: string; onDone: () => void }) {
  const { assignments, courses, selectedDate, notify } = useDashboard()
  const existing = assignments.items.find((a) => a.id === id)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [course, setCourse] = useState(existing?.courseId ?? courseId ?? courses.items[0]?.id ?? '')
  const [kind, setKind] = useState<Assignment['kind']>(existing?.kind ?? 'assignment')
  const [due, setDue] = useState(localInput.fromIso(existing?.due ?? defaultDue(selectedDate)))
  const [submitted, setSubmitted] = useState(existing?.submitted ?? false)
  const [grade, setGrade] = useState(existing?.grade != null ? String(existing.grade) : '')
  const [outOf, setOutOf] = useState(String(existing?.outOf ?? SCALE))

  if (courses.items.length === 0) {
    return <p className="px-1 pb-4 text-body text-muted">Add a course first, then you can add its deadlines.</p>
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const mark = grade.trim() === '' ? undefined : Number(grade.replace(',', '.'))
    const scale = Number(outOf.replace(',', '.')) || SCALE
    const data = {
      title: title.trim(),
      courseId: course,
      kind,
      due: localInput.toIso(due),
      // A grade means it's done.
      submitted: submitted || mark != null,
      grade: mark != null && Number.isFinite(mark) ? mark : undefined,
      outOf: mark != null && scale !== SCALE ? scale : undefined,
    }
    if (existing) assignments.update(existing.id, data)
    else assignments.add(data)
    notify(existing ? 'Deadline saved' : 'Deadline added')
    onDone()
  }

  const remove = () => {
    if (!existing) return
    assignments.remove(existing.id)
    notify('Deadline deleted')
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Segmented label="Type" options={kinds} value={kind} onChange={setKind} block />
      <Field label="Title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Problem set 8" required autoFocus={!existing} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Course">
          <Select value={course} onChange={(e) => setCourse(e.target.value)}>
            {courses.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code || c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due">
          <TextInput type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
        </Field>
      </div>
      {existing && <Toggle label={kind === 'assignment' ? 'Submitted' : 'Done'} checked={submitted} onChange={setSubmitted} />}
      {existing && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grade" hint="Leave empty until you get it.">
            <TextInput type="text" inputMode="decimal" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="–" />
          </Field>
          <Field label="Out of">
            <TextInput type="text" inputMode="decimal" value={outOf} onChange={(e) => setOutOf(e.target.value)} />
          </Field>
        </div>
      )}
      <div className="mt-1 flex items-center gap-2">
        {existing && (
          <Button variant="danger" onClick={remove}>
            Delete
          </Button>
        )}
        <Button type="submit" variant="primary" className="ml-auto min-w-28">
          {existing ? 'Save' : `Add ${kind}`}
        </Button>
      </div>
    </form>
  )
}
