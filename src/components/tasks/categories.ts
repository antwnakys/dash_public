import type { TaskCategory } from '@/types'
import { t } from '@/i18n'
import { byRole } from '@/lib/role'

export const categoryLabel: Record<TaskCategory, string> = {
  // Not a student: the "college" category reads as Work.
  college: byRole('cat.college', 'cat.work'),
  personal: t('cat.personal'),
  projects: t('cat.projects'),
}

export const categories = Object.keys(categoryLabel) as TaskCategory[]
