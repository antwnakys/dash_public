import { useState } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { useMoveItem } from '@/hooks/useMoveItem'
import { editTarget, isMovable, kindLabel } from '@/lib/agenda'
import { dayEntries, type CalEntry } from '@/lib/calendarDay'
import { cn } from '@/lib/cn'
import { fmt, isSameDay } from '@/lib/date'
import { locale, t } from '@/i18n'

const entryTone: Record<CalEntry['kind'], string> = {
  class: 'border-course bg-course/10',
  exam: 'border-accent bg-accent/10',
  quiz: 'border-accent bg-accent/10',
  assignment: 'border-ink/60 bg-fill',
  task: 'border-faint bg-fill',
  event: 'border-faint/60 bg-fill/60',
  reminder: 'border-faint/60 bg-fill/60',
}

/** One item in a day: time, title, a coloured edge by kind. Own items can be dragged to another day (computers). */
export function EntryChip({ entry, compact }: { entry: CalEntry; compact?: boolean }) {
  const { openEditor } = useDashboard()
  const target = entry.item ? editTarget(entry.item) : entry.courseId ? ({ type: 'course', id: entry.courseId } as const) : null
  const draggable = Boolean(entry.item && isMovable(entry.item))
  const due = entry.kind === 'assignment' || entry.kind === 'task' || entry.kind === 'quiz'
  const time = entry.allDay ? (due ? t('wk.due') : t('ef.allDay')) : due ? t('wk.dueAt', { time: fmt.time.format(entry.start) }) : fmt.time.format(entry.start)
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/unidash-entry', entry.key)
        e.dataTransfer.effectAllowed = 'move'
      }}
      disabled={!target}
      onClick={() => target && openEditor(target)}
      title={`${kindLabel[entry.kind]}: ${entry.title}${draggable ? ` ${t('wk.dragHint')}` : ''}`}
      className={cn(
        'w-full rounded-[0.4rem] border-s-[3px] px-2 py-1 text-start transition-colors enabled:hover:brightness-95 dark:enabled:hover:brightness-125',
        entryTone[entry.kind],
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <span className="block text-caption text-muted tabular-nums">{time}</span>
      <span className={cn('block text-subhead font-medium text-ink', compact ? 'line-clamp-2' : 'truncate')}>{entry.title}</span>
    </button>
  )
}

/**
 * Week view: Monday to Sunday side by side on wide screens (drag an own deadline, event or task onto another day to
 * move it), one day under another on phones.
 */
export function WeekGrid({ days, now }: { days: Date[]; now: Date }) {
  const { agenda, courses, setSelectedDate } = useDashboard()
  const move = useMoveItem()
  const [over, setOver] = useState<number | null>(null)
  const columns = days.map((d) => dayEntries(d, agenda, courses.items))

  const drop = (e: React.DragEvent, day: Date) => {
    e.preventDefault()
    setOver(null)
    const key = e.dataTransfer.getData('text/unidash-entry')
    const entry = columns.flat().find((x) => x.key === key)
    if (entry?.item) move(entry.item, day)
  }

  return (
    <div className="surface overflow-hidden md:grid md:grid-cols-7 md:divide-x md:divide-line rtl:md:divide-x-reverse">
      {days.map((d, i) => {
        const today = isSameDay(d, now)
        return (
          <div
            key={d.toISOString()}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('text/unidash-entry')) return
              e.preventDefault()
              setOver(i)
            }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => drop(e, d)}
            className={cn('flex min-w-0 flex-col border-t border-line first:border-t-0 md:min-h-[22rem] md:border-t-0', over === i && 'bg-accent/8')}
          >
            <button
              onClick={() => setSelectedDate(d)}
              className="flex items-baseline gap-2 px-3 pt-3 pb-2 text-start md:flex-col md:items-start md:gap-0"
              aria-label={today ? t('wk.todayLabel', { day: fmt.longDate.format(d) }) : fmt.longDate.format(d)}
            >
              <span className={cn('text-caption font-semibold uppercase tracking-wide', today ? 'text-accent' : 'text-muted')}>
                {fmt.weekdayShort.format(d)}
              </span>
              <span className={cn('text-title tabular-nums', today ? 'text-accent' : 'text-ink')}>{d.toLocaleDateString(locale, { day: 'numeric' })}</span>
            </button>
            <div className="flex flex-col gap-1.5 px-2 pb-3">
              {columns[i].map((entry) => (
                <EntryChip key={entry.key} entry={entry} compact />
              ))}
              {columns[i].length === 0 && <span className="hidden px-1 text-caption text-faint md:block">—</span>}
              {columns[i].length === 0 && <span className="px-1 text-caption text-faint md:hidden">{t('wk.nothing')}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
