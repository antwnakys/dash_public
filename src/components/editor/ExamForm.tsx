import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmButton } from '@/components/ui/ConfirmButton'
import { useDashboard } from '@/context/DashboardContext'
import { formatDate, formatTime, hhmm, ymd } from '@/lib/schedule'
import { Field, PickerPill, TextInput } from './fields'
import { t } from '@/i18n'

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
      notify(t('xf.saved'))
    } else {
      events.add(data)
      notify(t('xf.added'))
      setView('exams')
    }
    onDone()
  }

  const remove = () => {
    if (!existing) return
    events.remove(existing.id)
    notify(t('xf.deleted'), 'default', { label: t('common.undo'), run: () => events.set((l) => (l.some((e) => e.id === existing.id) ? l : [...l, existing])) })
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t('xf.what')}>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('xf.whatPh')} required autoFocus={!existing} />
      </Field>
      <div className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
        <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-1.5">
          <span className="text-body text-ink">{t('common.day')}</span>
          <PickerPill type="date" label={t('xf.day')} value={date} display={formatDate} onChange={(v) => v && setDate(v)} />
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-1.5">
          <span className="text-body text-ink">{t('common.time')}</span>
          <PickerPill type="time" label={t('xf.time')} value={time} display={formatTime} placeholder={t('common.notSet')} onChange={setTime} />
        </div>
      </div>
      <Field label={t('common.where')}>
        <TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('common.optional')} />
      </Field>
      <Field label={t('xf.link')} hint={t('xf.linkHint')}>
        <TextInput type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
      </Field>
      <div className="flex items-center gap-2">
        {existing && (
          <ConfirmButton onConfirm={remove}>{t('common.delete')}</ConfirmButton>
        )}
        <Button type="submit" variant="primary" className={existing ? 'ms-auto min-w-28' : 'w-full'}>
          {existing ? t('xf.save') : t('xf.add')}
        </Button>
      </div>
    </form>
  )
}
