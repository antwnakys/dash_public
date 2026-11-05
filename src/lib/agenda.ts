import type { AgendaKind } from '@/types'

export const kindLabel: Record<AgendaKind, string> = {
  assignment: 'Assignment',
  exam: 'Exam',
  quiz: 'Quiz',
  event: 'Event',
  reminder: 'Reminder',
  class: 'Course',
  task: 'Task',
}
