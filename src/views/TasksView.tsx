import { PageHeader } from '@/components/layout/PageHeader'
import { TaskList } from '@/components/tasks/TaskList'
import { Reveal, RevealItem } from '@/components/ui/Reveal'
import { useDashboard } from '@/context/DashboardContext'
import { t } from '@/i18n'

export function TasksView() {
  const { tasks } = useDashboard()
  const open = tasks.tasks.filter((t) => !t.done).length
  return (
    <Reveal id="tasks" className="mx-auto max-w-[44rem]">
      <PageHeader
        shortTitle={t('tv.title')}
        eyebrow={t('tv.eyebrow')}
        title={t('tv.title')}
        summary={tasks.tasks.length > 0 && (open === 0 ? t('tv.allDone') : t('tv.open', { n: open }))}
      />
      <RevealItem>
        <TaskList title={t('tv.all')} />
      </RevealItem>
    </Reveal>
  )
}
