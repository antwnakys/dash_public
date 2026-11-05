import type { Assignment } from '@/types'

/** Greek university scale. */
export const SCALE = 10

/** A grade on the 0–10 scale, whatever it was marked out of. */
export const onScale = (a: Assignment): number | undefined =>
  a.grade == null || !(a.outOf ?? SCALE) ? undefined : (a.grade / (a.outOf ?? SCALE)) * SCALE

/** Mean of the graded work, on the 0–10 scale. */
export function average(list: Assignment[]): { value: number; count: number } | undefined {
  const marks = list.map(onScale).filter((g): g is number => g != null)
  if (!marks.length) return undefined
  return { value: marks.reduce((s, g) => s + g, 0) / marks.length, count: marks.length }
}

/** "8.25" → "8.3", "8" → "8". */
export const formatGrade = (g: number) => (Math.round(g * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 })
