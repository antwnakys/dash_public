import { Plus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { categories, categoryLabel } from '@/components/tasks/categories'
import { Checkbox } from '@/components/tasks/Checkbox'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { useDashboard } from '@/context/DashboardContext'
import { uid } from '@/lib/id'
import { spring } from '@/lib/motion'
import { repeatLabel } from '@/lib/quickAdd'
import { formatDate, formatTime, hhmm, ymd } from '@/lib/schedule'
import type { Subtask, TaskCategory, TaskPriority, TaskRepeat } from '@/types'
import { Field, PickerPill, Select, TextArea, TextInput, Toggle } from './fields'
import { t } from '@/i18n'

const options = categories.map((c) => ({ value: c, label: categoryLabel[c] }))

const priorities: Array<{ value: '0' | '3' | '2' | '1'; label: string }> = [
  { value: '0', label: t('common.none') },
  { value: '3', label: t('prio.low') },
  { value: '2', label: t('prio.medium') },
  { value: '1', label: t('prio.high') },
]

/** New task, or edit one: due date and time, repeat, priority, steps, tags and notes. */
export function TaskForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { tasks, notify } = useDashboard()
  const existing = tasks.tasks.find((x) => x.id === id)
  const existingDue = existing?.due ? new Date(existing.due) : undefined

  const [title, setTitle] = useState(existing?.title ?? '')
  const [category, setCategory] = useState<TaskCategory>(existing?.category ?? 'college')
  const [priority, setPriority] = useState<'0' | '1' | '2' | '3'>(existing?.priority ? (String(existing.priority) as '1') : '0')
  const [hasDue, setHasDue] = useState(Boolean(existingDue))
  // New tasks default to tomorrow.
  const [date, setDate] = useState(() => (existingDue ? ymd(existingDue) : ymd(new Date(Date.now() + 86_400_000))))
  const [time, setTime] = useState(existingDue && !existing?.dueAllDay ? hhmm(existingDue) : '')
  const [repeat, setRepeat] = useState<TaskRepeat | ''>(existing?.repeat ?? '')
  const [steps, setSteps] = useState<Subtask[]>(existing?.subtasks ?? [])
  const [newStep, setNewStep] = useState('')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [tagText, setTagText] = useState((existing?.tags ?? []).map((g) => `#${g}`).join(' '))

  const addStep = () => {
    const text = newStep.trim()
    if (!text) return
    setSteps((s) => [...s, { id: uid(), title: text, done: false }])
    setNewStep('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    // Without a time the task is due that day (it sorts and reminds as the end of the day).
    const due = hasDue && date ? new Date(`${date}T${time || '23:59'}`).toISOString() : undefined
    const pending = newStep.trim() ? [...steps, { id: uid(), title: newStep.trim(), done: false }] : steps
    const tags = [...new Set(tagText.split(/[\s,]+/).map((g) => g.replace(/^#/, '').toLocaleLowerCase()).filter(Boolean))]
    const fields = {
      due,
      dueAllDay: due && !time ? true : undefined,
      repeat: due && repeat ? repeat : undefined,
      priority: priority === '0' ? undefined : (Number(priority) as TaskPriority),
      subtasks: pending.length ? pending : undefined,
      notes: notes.trim() || undefined,
      tags: tags.length ? tags : undefined,
    }
    if (existing) {
      tasks.update(existing.id, { title: title.trim(), category, ...fields })
      notify(t('tf.saved'))
    } else {
      tasks.add(title.trim(), category, fields)
      notify(t('tf.added'))
    }
    onDone()
  }

  const remove = () => {
    if (!existing) return
    const index = tasks.tasks.findIndex((x) => x.id === existing.id)
    tasks.remove(existing.id)
    notify(t('tf.deleted'), 'default', { label: t('common.undo'), run: () => tasks.restore(existing, index) })
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t('tf.task')}>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('tf.taskPh')} required autoFocus={!existing} />
      </Field>
      <Segmented label={t('tf.category')} options={options} value={category} onChange={setCategory} block />
      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-subhead font-medium text-muted">{t('tf.priority')}</span>
        <Segmented label={t('tf.priority')} options={priorities} value={priority} onChange={setPriority} block />
      </div>

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
            <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-1.5">
              <span className="text-body text-ink">{t('tf.repeat')}</span>
              <div className="w-44">
                <Select value={repeat} onChange={(e) => setRepeat(e.target.value as TaskRepeat | '')} aria-label={t('tf.repeat')} className="h-9">
                  <option value="">{t('tf.never')}</option>
                  {(Object.keys(repeatLabel) as TaskRepeat[]).map((r) => (
                    <option key={r} value={r}>
                      {repeatLabel[r]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-subhead font-medium text-muted">{t('tf.steps')}</span>
        <div className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
          <AnimatePresence initial={false}>
            {steps.map((s) => (
              <motion.div
                key={s.id}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={spring.smooth}
                className="overflow-hidden"
              >
                <div className="flex min-h-11 items-center gap-3 py-1 ps-3 pe-1.5">
                  <Checkbox checked={s.done} label={s.title} onToggle={() => setSteps((list) => list.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} />
                  <input
                    value={s.title}
                    onChange={(e) => setSteps((list) => list.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                    aria-label={t('tf.step')}
                    className={`min-w-0 flex-1 bg-transparent text-base outline-none sm:text-[0.9375rem] ${s.done ? 'text-faint line-through' : 'text-ink'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSteps((list) => list.filter((x) => x.id !== s.id))}
                    aria-label={t('tf.removeStep', { title: s.title })}
                    className="flex size-8 items-center justify-center rounded-full text-faint hover:bg-fill hover:text-ink"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="flex min-h-11 items-center gap-3 ps-3.5 pe-1.5">
            <Plus aria-hidden className="size-4 shrink-0 text-accent" strokeWidth={2.4} />
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addStep()
                }
              }}
              placeholder={t('tf.addStep')}
              aria-label={t('tf.newStep')}
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint sm:text-[0.9375rem]"
            />
          </div>
        </div>
      </div>

      <Field label={t('tf.tags')}>
        <TextInput value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder={t('tf.tagsPh')} autoCapitalize="off" autoCorrect="off" />
      </Field>
      <Field label={t('tf.notes')}>
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t('tf.notesPh')} />
      </Field>

      <div className="flex items-center gap-2">
        {existing && (
          <Button variant="danger" onClick={remove}>
            {t('common.delete')}
          </Button>
        )}
        <Button type="submit" variant="primary" className={existing ? 'ms-auto min-w-28' : 'w-full'}>
          {existing ? t('tf.save') : t('tf.add')}
        </Button>
      </div>
    </form>
  )
}
