import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { formatDate, formatTime, hhmm, ymd } from '@/lib/schedule'
import { Field, PickerPill, TextInput } from './fields'

/** + → Exam: an exam that isn't tied to a course deadline (driving theory, a language test…), or edit one. */
export function ExamForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { events, notify, setView } = useDashboard()
  const existing = events.items.find((e) => e.id === id && e.kind === 'exam')
  const start = existing ? new Date(existing.start) : undefined

  const [title, setTitle] = useState(existing?.title ?? '')
  // A week from now is a sensible starting point for a new exam.
  const [date, setDate] = useState(() => (start ? ymd(start) : ymd(new Date(Date.now() + 7 * 86_400_000))))
  const [time, setTime] = useState(start && !existing?.allDay ? hhmm(start) : '')
  const [location, setLocation] = useState(existing?.location ?? '')
  const [url, setUrl] = useState(existing?.url ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    const data = {
      title: title.trim(),
      start: new Date(`${date}T${time || '00:00'}`).toISOString(),
      allDay: time ? undefined : true,
      location: location.trim() || undefined,
      url: /^https?:\/\//i.test(url.trim()) ? url.trim() : url.trim() ? `https://${url.trim()}` : undefined,
      kind: 'exam' as const,
    }
    if (existing) {
      events.update(existing.id, data)
      notify('Exam saved')
    } else {
      events.add(data)
      notify('Exam added. Make a study plan for it here.')
      setView('exams')
    }
    onDone()
  }

  const remove = () => {
    if (!existing || !confirm(`Delete the ${existing.title} exam?`)) return
    events.remove(existing.id)
    notify('Exam deleted')
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label="What's the exam?">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ΣΗΜΑΤΑ, Databases final…" required autoFocus={!existing} />
      </Field>
      <div className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
        <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-1.5">
          <span className="text-body text-ink">Day</span>
          <PickerPill type="date" label="Exam day" value={date} display={formatDate} onChange={(v) => v && setDate(v)} />
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-1.5">
          <span className="text-body text-ink">Time</span>
          <PickerPill type="time" label="Exam time" value={time} display={formatTime} placeholder="Not set" onChange={setTime} />
        </div>
      </div>
      <Field label="Where">
        <TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Link" hint="A practice site or anything you'll want one tap away. Shows as a button on the exam.">
        <TextInput type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
      </Field>
      <div className="flex items-center gap-2">
        {existing && (
          <Button variant="danger" onClick={remove}>
            Delete
          </Button>
        )}
        <Button type="submit" variant="primary" className={existing ? 'ml-auto min-w-28' : 'w-full'}>
          {existing ? 'Save exam' : 'Add exam'}
        </Button>
      </div>
    </form>
  )
}
