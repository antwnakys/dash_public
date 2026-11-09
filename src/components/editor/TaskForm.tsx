import { useState, type FormEvent } from 'react'
import { categories, categoryLabel } from '@/components/tasks/categories'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { useDashboard } from '@/context/DashboardContext'
import { formatDate, formatTime, hhmm, ymd } from '@/lib/schedule'
import type { TaskCategory } from '@/types'
import { Field, PickerPill, TextInput, Toggle } from './fields'
import { t } from '@/i18n'

const options = categories.map((c) => ({ value: c, label: categoryLabel[c] }))

/** New task, or edit one (with an optional due date and time). */
export function TaskForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { tasks, notify } = useDashboard()
  const existing = tasks.tasks.find((t) => t.id === id)
  const existingDue = existing?.due ? new Date(existing.due) : undefined

  const [title, setTitle] = useState(existing?.title ?? '')
  const [category, setCategory] = useState<TaskCategory>(existing?.category ?? 'college')
  const [hasDue, setHasDue] = useState(Boolean(existingDue))
  // New tasks default to tomorrow.
  const [date, setDate] = useState(() => (existingDue ? ymd(existingDue) : ymd(new Date(Date.now() + 86_400_000))))
  const [time, setTime] = useState(existingDue && !existing?.dueAllDay ? hhmm(existingDue) : '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    // Without a time the task is due that day (it sorts and reminds as the end of the day).
    const due = hasDue && date ? new Date(`${date}T${time || '23:59'}`).toISOString() : undefined
    const patch = { due, dueAllDay: due && !time ? true : undefined }
    if (existing) {
      tasks.update(existing.id, { title: title.trim(), category, ...patch })
      notify(t('tf.saved'))
    } else {
      tasks.add(title.trim(), category, patch)
      notify(t('tf.added'))
    }
    onDone()
  }

  const remove = () => {
    if (!existing) return
    tasks.remove(existing.id)
    notify(t('tf.deleted'))
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t('tf.task')}>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('tf.taskPh')} required autoFocus={!existing} />
      </Field>
      <Segmented label={t('tf.category')} options={options} value={category} onChange={setCategory} block />
      <div className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
        <div className="px-3 py-1.5">
          <Toggle label={t('tf.dueDate')} checked={hasDue} onChange={setHasDue} />
        </div>
        {hasDue && (
          <>
            <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-1.5">
              <span className="text-body text-ink">{t('common.day')}</span>
              <PickerPill type="date" label={t('tf.dueDay')} value={date} display={formatDate} onChange={(v) => v && setDate(v)} />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-1.5">
              <span className="text-body text-ink">{t('common.time')}</span>
              <PickerPill type="time" label={t('tf.dueTime')} value={time} display={formatTime} placeholder={t('tf.anyTime')} onChange={setTime} />
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {existing && (
          <Button variant="danger" onClick={remove}>
            {t('common.delete')}
          </Button>
        )}
        <Button type="submit" variant="primary" className={existing ? 'ml-auto min-w-28' : 'w-full'}>
          {existing ? t('tf.save') : t('tf.add')}
        </Button>
      </div>
    </form>
  )
}
