import type { AgendaItem, AgendaKind, EditorTarget } from '@/types'
import { t } from '@/i18n'

export const kindLabel: Record<AgendaKind, string> = {
  assignment: t('kind.assignment'),
  exam: t('kind.exam'),
  quiz: t('kind.quiz'),
  event: t('kind.event'),
  reminder: t('kind.reminder'),
  class: t('kind.class'),
  task: t('kind.task'),
}

/** Which editor an agenda item opens: own things open their form, a synced class opens its course, others nothing. */
export function editTarget(item: AgendaItem): EditorTarget | null {
  if (item.source === 'assignment') return { type: 'deadline', id: item.id }
  if (item.source === 'event') return item.kind === 'exam' ? { type: 'exam', id: item.id } : { type: 'event', id: item.id }
  if (item.source === 'task') return { type: 'task', id: item.id }
  return item.courseId ? { type: 'course', id: item.courseId } : null
}

/** Deadlines, own events and tasks can be moved in unidash; synced calendar events are changed in Google Calendar. */
export const isMovable = (item: AgendaItem) => item.source !== 'calendar'
