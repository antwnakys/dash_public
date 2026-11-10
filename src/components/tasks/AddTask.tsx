import { CalendarClock, Flag, Hash, Plus, Repeat, Tag, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState, type FormEvent } from 'react'
import { useNow } from '@/hooks/useNow'
import { dueText } from '@/lib/taskDue'
import { spring } from '@/lib/motion'
import { parseQuickAdd, priorityLabel, quickFields, repeatLabel, type QuickPartKind, type QuickTask } from '@/lib/quickAdd'
import { t } from '@/i18n'
import type { Task, TaskCategory } from '@/types'
import { categories, categoryLabel } from './categories'

const icons: Record<QuickPartKind, typeof Flag> = { due: CalendarClock, priority: Flag, category: Tag, repeat: Repeat, tags: Hash }

/** What the typed line was read as, one chip per kind; × puts that phrase back into the title. */
function chips(q: QuickTask): Array<{ kind: QuickPartKind; label: string }> {
  const out: Array<{ kind: QuickPartKind; label: string }> = []
  if (q.due) out.push({ kind: 'due', label: dueText(q.due, q.dueAllDay) })
  if (q.repeat) out.push({ kind: 'repeat', label: repeatLabel[q.repeat] })
  if (q.priority) out.push({ kind: 'priority', label: t('qa.priority', { p: priorityLabel[q.priority] }) })
  if (q.category) out.push({ kind: 'category', label: categoryLabel[q.category] })
  if (q.tags?.length) out.push({ kind: 'tags', label: q.tags.map((t) => `#${t}`).join(' ') })
  return out
}

/**
 * Quick add: type a whole task in one line ("Essay draft friday at 18:00 !! every week"). What's understood shows
 * under the box before saving, and any of it can be taken back with ×.
 */
export function AddTask({
  defaultCategory,
  onAdd,
  autoFocus,
}: {
  defaultCategory: TaskCategory
  onAdd: (title: string, category: TaskCategory, extra: Partial<Task>) => void
  autoFocus?: boolean
}) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<TaskCategory | null>(null)
  const [ignore, setIgnore] = useState<QuickPartKind[]>([])
  const now = useNow(60_000)
  const parsed = useMemo(() => parseQuickAdd(text, now, ignore), [text, now, ignore])
  const shown = text.trim() ? chips(parsed) : []
  const chosen = parsed.category ?? category ?? defaultCategory

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onAdd(parsed.title, chosen, quickFields(parsed))
    setText('')
    setIgnore([])
  }

  return (
    <form onSubmit={submit}>
      <div className="flex min-h-[3.25rem] items-center gap-3 pe-2 ps-4">
        <Plus aria-hidden className="size-[18px] shrink-0 text-accent" strokeWidth={2.4} />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (!e.target.value) setIgnore([])
          }}
          placeholder={t('tasks.addHint')}
          aria-label={t('tasks.new')}
          aria-describedby="quick-add-reading"
          enterKeyHint="done"
          autoFocus={autoFocus}
          data-quick-add
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder:text-faint focus:outline-none sm:text-[0.9375rem]"
        />
        <select
          value={chosen}
          onChange={(e) => setCategory(e.target.value as TaskCategory)}
          aria-label={t('tasks.category')}
          disabled={Boolean(parsed.category)}
          className="h-8 max-w-36 shrink-0 appearance-none rounded-[var(--radius-button)] bg-fill px-3 text-subhead font-medium text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel[c]}
            </option>
          ))}
        </select>
      </div>
      <div id="quick-add-reading" aria-live="polite">
        <AnimatePresence initial={false}>
          {shown.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.smooth}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-1.5 pe-3 pb-3 ps-[2.875rem]">
                <span className="text-caption text-faint">
                  “{parsed.title}”
                </span>
                {shown.map((c) => {
                  const Icon = icons[c.kind]
                  return (
                    <span key={c.kind} className="inline-flex items-center gap-1 rounded-[var(--radius-button)] bg-accent/10 py-0.5 pe-0.5 ps-2 text-caption font-medium text-accent">
                      <Icon aria-hidden className="size-3" strokeWidth={2.4} />
                      {c.label}
                      <button
                        type="button"
                        onClick={() => setIgnore((list) => [...list, c.kind])}
                        aria-label={t('qa.unread', { label: c.label })}
                        className="flex size-5 items-center justify-center rounded-full hover:bg-accent/15"
                      >
                        <X aria-hidden className="size-3" strokeWidth={2.4} />
                      </button>
                    </span>
                  )
                })}
                <span className="text-caption text-faint">{t('qa.enter')}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  )
}
