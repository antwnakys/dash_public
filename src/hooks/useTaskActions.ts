import { useDashboard } from '@/context/DashboardContext'
import { dueText } from '@/lib/taskDue'
import { t } from '@/i18n'
import type { Task } from '@/types'

/** Tick, delete with Undo, and announce the next copy of a repeating task. */
export function useTaskActions() {
  const { tasks, notify } = useDashboard()
  return {
    toggle: (task: Task) => {
      const next = tasks.toggle(task.id)
      if (next?.due) notify(t('qa.next', { when: dueText(next.due, next.dueAllDay) }))
    },
    remove: (task: Task) => {
      const index = tasks.tasks.findIndex((t) => t.id === task.id)
      tasks.remove(task.id)
      notify(t('qa.deleted', { title: task.title.length > 28 ? `${task.title.slice(0, 27)}…` : task.title }), 'default', {
        label: t('common.undo'),
        run: () => tasks.restore(task, index),
      })
    },
  }
}
