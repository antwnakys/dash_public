/**
 * unidash for students or for everyone. Students (the default) get courses, exams and school wording; everyone else
 * (`profile.role === 'other'`) gets the same app without Courses and Exams, with "work" instead of "school", and their
 * usual days and hours (`profile.routine`) in place of class times.
 *
 * Labels and the list of sections are worked out once per page load (`student`); changing the role in Settings
 * reloads the page, and the first-open setup reloads when it finishes with a different answer.
 */
import type { Course, CourseMeeting, Profile } from '@/types'
import { t, type Key } from '@/i18n'

export const isStudent = (profile: Pick<Profile, 'role'> | undefined) => profile?.role !== 'other'

function roleAtLoad(): boolean {
  try {
    const raw = localStorage.getItem('unidash.profile.v1')
    return isStudent(raw ? (JSON.parse(raw) as Profile) : undefined)
  } catch {
    return true
  }
}

/** This page load is in student mode. */
export const student = roleAtLoad()

/** The student text or the everyone-else text. */
export const byRole = (forStudents: Key, forOthers: Key, isStudentNow = student) => t(isStudentNow ? forStudents : forOthers)

/** The weekly times that count as "classes" (Leave card, calendar, widget, reminders): courses for students, the
 * usual days at work for everyone else. */
export function scheduleOf(role: Profile['role'], routine: Profile['routine'], courses: Course[]): Course[] {
  if (isStudent({ role })) return courses
  const meetings = (routine ?? []).filter((m) => m.days.length)
  if (!meetings.length) return []
  return [{ id: 'routine', code: '', name: t('routine.title'), instructor: '', progress: 0, schedule: '', meetings, links: [] }]
}

/** Courses and Exams sections exist only for students. */
export const showsView = (id: string) => student || (id !== 'courses' && id !== 'exams')

/** A first guess at the usual days at work: Monday to Friday, 9 to 5. */
export const newWorkTimes = (): CourseMeeting => ({ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' })

/** After switching role: reload once the profile is saved, so sections and labels follow. */
export const reloadForRole = () => window.setTimeout(() => window.location.reload(), 300)
