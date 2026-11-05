import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { useDashboard } from '@/context/DashboardContext'
import type { CalendarEvent } from '@/types'
import { localInput } from '@/lib/localInput'
import { Field, TextInput, Toggle } from './fields'

const kinds = [
  { value: 'event' as const, label: 'Event' },
  { value: 'reminder' as const, label: 'Reminder' },
]

/** Default start: the selected day at 09:00, or the next full hour today. */
function defaultStart(selected: Date): string {
  const d = new Date(selected)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) d.setHours(now.getHours() + 1, 0, 0, 0)
  else d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

export function EventForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { events, selectedDate, notify } = useDashboard()
  const existing = events.items.find((e) => e.id === id)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [kind, setKind] = useState<CalendarEvent['kind']>(existing?.kind ?? 'event')
  const [allDay, setAllDay] = useState(existing?.allDay ?? false)
  const [start, setStart] = useState(existing?.start ?? defaultStart(selectedDate))
  const [location, setLocation] = useState(existing?.location ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const startIso = allDay ? localInput.toIso(localInput.fromIso(start, true)) : start
    const data = { title: title.trim(), kind, allDay: allDay || undefined, start: startIso, location: location.trim() || undefined }
    if (existing) events.update(existing.id, data)
    else events.add(data)
    notify(existing ? 'Event saved' : 'Event added')
    onDone()
  }

  const remove = () => {
    if (!existing) return
    events.remove(existing.id)
    notify('Event deleted')
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Segmented label="Type" options={kinds} value={kind} onChange={setKind} block />
      <Field label="Title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Study group" required autoFocus={!existing} />
      </Field>
      <Toggle label="All day" checked={allDay} onChange={setAllDay} />
      <Field label={allDay ? 'Date' : 'Starts'}>
        <TextInput
          type={allDay ? 'date' : 'datetime-local'}
          value={localInput.fromIso(start, allDay)}
          onChange={(e) => e.target.value && setStart(localInput.toIso(e.target.value))}
          required
        />
      </Field>
      <Field label="Where">
        <TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
      </Field>
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
