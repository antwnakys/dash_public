import type { AgendaKind } from '@/types'
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
