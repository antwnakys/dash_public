import type { TaskCategory } from '@/types'
import { t } from '@/i18n'

export const categoryLabel: Record<TaskCategory, string> = {
  college: t('cat.college'),
  personal: t('cat.personal'),
  projects: t('cat.projects'),
}

export const categories = Object.keys(categoryLabel) as TaskCategory[]
