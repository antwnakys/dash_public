import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarPlus,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  CornerDownLeft,
  FileText,
  GraduationCap,
  Plus,
  Search,
  Settings,
  Timer,
  NotebookPen,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { cn } from '@/lib/cn'
import { paletteKey } from '@/lib/keys'
import { blur, spring } from '@/lib/motion'
import { parseQuickAdd, priorityLabel, quickFields, repeatLabel } from '@/lib/quickAdd'
import { countdown, fmt } from '@/lib/date'
import { dueText } from '@/lib/taskDue'
import { views, type ViewId } from '@/views'
import type { EditorTarget } from '@/types'
import { categoryLabel } from '@/components/tasks/categories'
import { t } from '@/i18n'

interface Item {
  id: string
  group: string
  label: string
  detail?: string
  icon: LucideIcon
  keys?: string
  run: () => void
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
const matches = (q: string, ...fields: Array<string | undefined>) => {
  if (!q) return true
  const words = norm(q).split(/\s+/).filter(Boolean)
  const hay = norm(fields.filter(Boolean).join(' '))
  return words.every((w) => hay.includes(w))
}

const SHORTCUTS: Array<[string, string]> = [
  [paletteKey, t('pal.palette')],
  ['N', t('pal.new')],
  ['T', t('pal.addTask')],
  ['F', t('focus.title')],
  [`1–${views.length}`, t('nav.sections')],
  ['/', t('pal.search')],
  ['Esc', t('common.close')],
]

/**
 * ⌘K: one box to search everything (tasks, courses, deadlines, exams, events), jump to a section, start anything new,
 * or add a task straight from what you typed (read with quick add, shown before Enter).
 */
export function CommandPalette() {
  const { palette, setPalette, tasks, courses, agenda, setView, openEditor, notify, setFocusOpen, classNotes } = useDashboard()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const close = () => {
    setPalette(false)
    setQuery('')
    setActive(0)
  }
  const go = (v: ViewId) => {
    close()
    setView(v)
  }
  const open = (target: EditorTarget) => {
    close()
    openEditor(target)
  }

  // Rebuilt on each render while open: a few hundred string checks at most.
  const items: Item[] = !palette ? [] : (() => {
    const q = query.trim()
    const out: Item[] = []
    let addItem: Item | undefined
    if (q) {
      const quick = parseQuickAdd(q)
      const bits = [
        quick.due && dueText(quick.due, quick.dueAllDay),
        quick.repeat && repeatLabel[quick.repeat],
        quick.priority && t('qa.priority', { p: priorityLabel[quick.priority] }),
        quick.category && categoryLabel[quick.category],
      ].filter(Boolean)
      addItem = {
        id: 'add',
        group: t('pal.gAdd'),
        label: t('pal.addThis', { title: quick.title }),
        detail: bits.length ? bits.join(' · ') : t('pal.noDate'),
        icon: Plus,
        run: () => {
          const task = tasks.add(quick.title, quick.category ?? 'college', quickFields(quick))
          close()
          notify(task.due ? t('tl.addedFor', { when: dueText(task.due, task.dueAllDay) }) : t('tf.added'))
        },
      }
    }
    const create: Array<[string, LucideIcon, EditorTarget]> = [
      [t('pal.newTask'), CheckSquare, { type: 'task' }],
      [t('pal.newExam'), ClipboardCheck, { type: 'exam' }],
      [t('pal.newDeadline'), FileText, { type: 'deadline' }],
      [t('pal.newEvent'), CalendarPlus, { type: 'event' }],
      [t('pal.newCourse'), GraduationCap, { type: 'course' }],
    ]
    // Each item also matches its English words, so "new task" finds it in any language.
    const en = ['task', 'exam', 'deadline', 'event', 'course']
    create.forEach(([label, icon, target], i) => {
      if (matches(q, label, `new add create ${en[i]}`)) out.push({ id: `new-${en[i]}`, group: t('pal.gCreate'), label, icon, run: () => open(target) })
    })
    views.forEach((v, i) => {
      if (matches(q, v.label, `go open show ${v.id}`)) out.push({ id: `go-${v.id}`, group: t('pal.gGo'), label: v.label, icon: v.icon, keys: String(i + 1), run: () => go(v.id) })
    })
    if (matches(q, t('focus.title'), t('pal.focusWords'), 'focus timer pomodoro study'))
      out.push({ id: 'focus', group: t('pal.gGo'), label: t('focus.title'), icon: Timer, keys: 'F', run: () => (close(), setFocusOpen(true)) })
    if (matches(q, t('rev.title'), 'weekly review week plan'))
      out.push({ id: 'review', group: t('pal.gGo'), label: t('rev.title'), icon: NotebookPen, run: () => open({ type: 'review' }) })
    if (matches(q, t('nav.settings'), t('pal.settingsWords'), 'settings preferences backup language theme'))
      out.push({ id: 'settings', group: t('pal.gGo'), label: t('nav.settings'), icon: Settings, run: () => open({ type: 'settings' }) })
    if (q) {
      const found = tasks.tasks
        .filter((x) => matches(q, x.title, x.notes, ...(x.subtasks ?? []).map((s) => s.title), ...(x.tags ?? []).map((g) => `#${g}`)))
        .sort((a, b) => Number(a.done) - Number(b.done))
        .slice(0, 6)
      for (const task of found)
        out.push({
          id: `task-${task.id}`,
          group: t('nav.tasks'),
          label: task.title,
          detail: task.done ? t('tl.done') : task.due ? dueText(task.due, task.dueAllDay) : categoryLabel[task.category],
          icon: CheckCircle2,
          run: () => open({ type: 'task', id: task.id }),
        })
      for (const c of courses.items.filter((c) => matches(q, c.name, c.code)).slice(0, 4))
        out.push({ id: `course-${c.id}`, group: t('nav.courses'), label: c.name, detail: c.code || undefined, icon: GraduationCap, run: () => open({ type: 'course', id: c.id }) })
      for (const n of classNotes.items.filter((n) => matches(q, n.text, ...(n.files ?? []).map((f) => f.name))).slice(0, 4)) {
        const course = courses.items.find((c) => c.id === n.courseId)
        out.push({
          id: `note-${n.id}`,
          group: t('notes.title'),
          label: n.text?.split('\n')[0].slice(0, 80) || n.files?.[0]?.name || t('notes.title'),
          detail: [course?.name, fmt.shortDate.format(new Date(`${n.date}T12:00`))].filter(Boolean).join(' · '),
          icon: NotebookPen,
          run: () => open({ type: 'classNote', courseId: n.courseId, id: n.id }),
        })
      }
      const seen = new Set<string>()
      for (const a of agenda.filter((a) => a.kind !== 'task' && matches(q, a.title, a.context))) {
        if (seen.has(a.title) || seen.size >= 5) continue
        seen.add(a.title)
        const target: EditorTarget | null =
          a.source === 'assignment' ? { type: 'deadline', id: a.id } : a.source === 'event' ? (a.kind === 'exam' ? { type: 'exam', id: a.id } : { type: 'event', id: a.id }) : null
        out.push({
          id: `agenda-${a.id}`,
          group: a.kind === 'exam' ? t('nav.exams') : a.kind === 'class' ? t('pal.gClasses') : t('nav.calendar'),
          label: a.title,
          detail: [a.context, countdown(a.date)].filter(Boolean).join(' · '),
          icon: a.kind === 'exam' ? ClipboardCheck : CalendarPlus,
          run: () => (target ? open(target) : go(a.kind === 'exam' ? 'exams' : 'calendar')),
        })
      }
    }
    // Typing a task ("Buy ink friday at 10"): Add task comes first. One or two words that match something
    // ("macro", "settings") are a search: matches first, Add task last.
    if (addItem) {
      if (q.split(/\s+/).length <= 2 && out.length) out.push(addItem)
      else out.unshift(addItem)
    }
    return out
  })()

  useEffect(() => {
    if (palette) requestAnimationFrame(() => input.current?.focus())
  }, [palette])

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(items.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[active]?.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  let lastGroup = ''
  return (
    <AnimatePresence>
      {palette && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-3 pt-[max(env(safe-area-inset-top),1rem)] sm:pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('pal.palette')}
            initial={{ opacity: 0, y: -8, scale: 0.98, ...blur(4) }}
            animate={{ opacity: 1, y: 0, scale: 1, ...blur(0) }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={spring.snappy}
            className="material flex max-h-[min(34rem,80dvh)] w-full max-w-[38rem] flex-col overflow-hidden rounded-[var(--radius-chrome)]"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search aria-hidden className="size-[18px] shrink-0 text-muted" />
              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                onKeyDown={onKey}
                placeholder={t('pal.ph')}
                aria-label={t('pal.aria')}
                aria-controls="palette-results"
                aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
                className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-faint focus:outline-none sm:text-[1.0625rem]"
              />
              <kbd className="hidden rounded-[0.35rem] bg-fill px-1.5 py-0.5 text-caption text-muted sm:block">Esc</kbd>
            </div>
            <ul ref={list} id="palette-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
              {items.map((item, i) => {
                const header = item.group !== lastGroup ? item.group : null
                lastGroup = item.group
                const Icon = item.icon
                return (
                  <li key={item.id} role="presentation">
                    {header && <div className="px-2.5 pt-2.5 pb-1 text-caption font-semibold tracking-wide text-faint uppercase">{header}</div>}
                    <button
                      id={`palette-${item.id}`}
                      role="option"
                      aria-selected={i === active}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={item.run}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-1.5 text-start',
                        i === active ? 'bg-fill-strong' : '',
                      )}
                    >
                      <Icon aria-hidden className={cn('size-[18px] shrink-0', item.id === 'add' ? 'text-accent' : 'text-muted')} strokeWidth={2} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-ink">{item.label}</span>
                        {item.detail && <span className="block truncate text-caption text-muted">{item.detail}</span>}
                      </span>
                      {item.keys && <kbd className="rounded-[0.35rem] bg-fill px-1.5 py-0.5 text-caption text-muted">{item.keys}</kbd>}
                      {i === active && <CornerDownLeft aria-hidden className="size-3.5 shrink-0 text-faint" />}
                    </button>
                  </li>
                )
              })}
              {items.length === 0 && <li className="px-3 py-8 text-center text-body text-muted">{t('pal.nothing', { query })}</li>}
            </ul>
            {!query && (
              <div className="hidden flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-caption text-muted sm:flex">
                {SHORTCUTS.map(([k, label]) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <kbd className="rounded-[0.35rem] bg-fill px-1.5 py-0.5 text-ink">{k}</kbd>
                    {label}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
