import { AnimatePresence, Reorder } from 'framer-motion'
import { useState } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { Card, Section } from '@/components/ui/Section'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { dueInfo, overdueFirst } from '@/lib/taskDue'
import type { TaskCategory } from '@/types'
import { AddTask } from './AddTask'
import { categories, categoryLabel } from './categories'
import { TaskItem } from './TaskItem'
import { t } from '@/i18n'

type Filter = 'all' | TaskCategory

const filters = [
  { value: 'all' as const, label: t('tasks.all') },
  ...categories.map((c) => ({ value: c, label: categoryLabel[c] })),
]

export function TaskList({ title = t('tasks.title') }: { title?: string }) {
  const { tasks } = useDashboard()
  const [filter, setFilter] = useState<Filter>('all')
  const now = useNow(60_000)

  const visible = overdueFirst(filter === 'all' ? tasks.tasks : tasks.tasks.filter((t) => t.category === filter), now)
  const done = visible.filter((t) => t.done).length

  return (
    <Section
      title={title}
      meta={visible.length > 0 && t('tasks.doneOf', { done, total: visible.length })}
      action={<Segmented label={t('tasks.filter')} options={filters} value={filter} onChange={setFilter} className="max-md:hidden" />}
    >
      <Segmented label={t('tasks.filter')} options={filters} value={filter} onChange={setFilter} block className="md:hidden" />
      <Card>
        <AddTask defaultCategory={filter === 'all' ? 'college' : filter} onAdd={tasks.add} />
        <Reorder.Group axis="y" values={visible} onReorder={tasks.reorder} className="separated border-t border-line">
          <AnimatePresence initial={false}>
            {visible.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                showCategory={filter === 'all'}
                due={dueInfo(task, now)}
                onToggle={() => tasks.toggle(task.id)}
                onRemove={() => tasks.remove(task.id)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
        {visible.length === 0 && (
          <p className="border-t border-line px-4 py-6 text-center text-body text-muted">
            {filter === 'all' ? t('tasks.empty') : t('tasks.emptyIn', { category: categoryLabel[filter] })}
          </p>
        )}
      </Card>
    </Section>
  )
}
