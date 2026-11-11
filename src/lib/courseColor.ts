import type { CSSProperties } from 'react'
import type { Course, CourseColor } from '@/types'
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

/**
 * Edge and tint for a class in the calendar and the timetable, in its course's colour; nothing when the course has
 * no colour (the default green from the CSS stays).
 */
export function courseTint(courses: Course[], courseId: string | undefined, strength = 10): CSSProperties | undefined {
  const color = courseId ? courses.find((c) => c.id === courseId)?.color : undefined
  if (!color) return undefined
  const c = courseColors[color]
  return { borderColor: c, backgroundColor: `color-mix(in srgb, ${c} ${strength}%, transparent)` }
}
