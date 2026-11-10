import type { CourseColor } from '@/types'
import { t } from '@/i18n'

/** Restrained identifiers that read in light and dark. */
export const courseColors: Record<CourseColor, string> = {
  slate: '#7a7f88',
  blue: 'var(--accent)',
  green: 'var(--course)',
  amber: '#c58a1b',
  red: 'var(--danger)',
  violet: '#7c5cc4',
}

export const courseColorNames: Record<CourseColor, string> = {
  slate: t('color.slate'),
  blue: t('color.blue'),
  green: t('color.green'),
  amber: t('color.amber'),
  red: t('color.red'),
  violet: t('color.violet'),
}
