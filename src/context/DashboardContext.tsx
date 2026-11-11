import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sampleData } from '@/data/sample'
import { useCalendarSync, type CalendarSync } from '@/hooks/useCalendarSync'
import { useCloudSync, type CloudSync } from '@/hooks/useCloudSync'
import { useCollection, type Collection } from '@/hooks/useCollection'
import { useHereLocation } from '@/hooks/useHereLocation'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useReminders, type RemindersState } from '@/hooks/useReminders'
import { useClassFileUploads } from '@/hooks/useClassFileUploads'
import { useWidget } from '@/hooks/useWidget'
import { useFocusTimer, type FocusTimer } from '@/hooks/useFocusTimer'
import { useTasks, type TasksApi } from '@/hooks/useTasks'
import { useTheme } from '@/hooks/useTheme'
import { useWeather, type WeatherState } from '@/hooks/useWeather'
import { isClass, isExamTitle } from '@/lib/school'
import { courseCalendarPatches, courseOf } from '@/lib/courseLink'
import { looksOnline } from '@/lib/meeting'
import { startOfDay } from '@/lib/date'
import { startLiveUpdates } from '@/lib/liveUpdate'
import { dailySnapshot } from '@/sync/backup'
import type { ViewId } from '@/views'
import type { AgendaItem, Assignment, CalendarEvent, ClassNote, Course, EditorTarget, ExamResult, FocusSession, LookPreference, Place, Profile, School, StudySession, Task, ThemePreference } from '@/types'
import { categoryLabel } from '@/components/tasks/categories'
import { t } from '@/i18n'

export interface Toast {
  id: number
  message: string
  tone?: 'default' | 'error'
  /** One button on the toast, e.g. Undo. */
  action?: { label: string; run: () => void }
}

interface DashboardValue {
  profile: Profile
  setProfile: (patch: Partial<Profile>) => void
  courses: Collection<Course>
  assignments: Collection<Assignment>
  events: Collection<CalendarEvent>
  /** Study sessions planned by unidash, and ticks on study events from the calendar. */
  study: Collection<StudySession>
  /** Scores and pass/fail for exams that are over: the exam history. */
  examResults: Collection<ExamResult>
  tasks: TasksApi
  /** Finished focus sessions (synced) and the timer (this device). */
  focusSessions: Collection<FocusSession>
  /** Notes and files per lecture (synced; file bytes per device + Google Drive, `lib/classFiles.ts`). */
  classNotes: Collection<ClassNote>
  focus: FocusTimer
  focusOpen: boolean
  setFocusOpen: (open: boolean) => void
  calendar: CalendarSync
  /** Syncs this device's data with every other device signed in to the same Google account. */
  cloud: CloudSync
  weather: WeatherState
  /** This device's current location (when following it) and whether location was refused. */
  location: { here?: Place; denied: boolean }
  /** Phone reminders for leaving and for deadlines (iPhone app). */
  reminders: RemindersState
  /** Open assignments and events in one chronological list. */
  agenda: AgendaItem[]
  selectedDate: Date
  setSelectedDate: (d: Date) => void
  /** The ⌘K command palette. */
  palette: boolean
  setPalette: (open: boolean) => void
  editor: EditorTarget | null
  openEditor: (target: EditorTarget) => void
  closeEditor: () => void
  loadSample: () => void
  clearAll: () => void
  theme: {
    preference: ThemePreference
    resolved: 'light' | 'dark'
    setPreference: (p: ThemePreference) => void
    look: { preference: LookPreference; setPreference: (p: LookPreference) => void }
  }
  toast: Toast | null
  /** Brief confirmation or error shown above the navigation. */
  notify: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void
  dismissToast: () => void
  view: ViewId
  setView: (v: ViewId) => void
}

const DashboardContext = createContext<DashboardValue | null>(null)

function buildAgenda(
  courses: Course[],
  assignments: Assignment[],
  events: CalendarEvent[],
  synced: CalendarEvent[],
  tasks: Task[],
  school: School | undefined,
): AgendaItem[] {
  const courseCode = new Map(courses.map((c) => [c.id, c.code]))
  // Events at the saved school address are classes: marked as a course and linked to one when the title matches.
  const asClass = (e: CalendarEvent): Partial<AgendaItem> | null => {
    if (!isClass(e, school)) return null
    const course = courseOf(e, courses)
    const link = e.link ?? course?.links.find((l) => l.kind === 'meeting')?.url
    const online = e.online || looksOnline(e.link, e.title) || undefined
    return {
      kind: 'class',
      // "STATISTICS/ONLINE" reads as the course it belongs to: "Statistics".
      title: online ? (course?.name ?? e.title.replace(/\s*[/(–-]?\s*online\s*\)?\s*$/i, '')) : e.title,
      courseId: course?.id,
      link: online ? link : e.link,
      online,
      context: [course?.code, online ? t('course.online') : e.location?.split(',')[0]].filter(Boolean).join(' · '),
    }
  }
  return [
    ...assignments
      .filter((a) => !a.submitted)
      .map<AgendaItem>((a) => ({
        id: a.id,
        source: 'assignment',
        title: a.title,
        date: new Date(a.due),
        kind: a.kind,
        context: courseCode.get(a.courseId),
      })),
    // Tasks with a due date show up next to deadlines.
    ...tasks
      .filter((t) => t.due && !t.done)
      .map<AgendaItem>((t) => ({
        id: t.id,
        source: 'task',
        title: t.title,
        date: new Date(t.due!),
        kind: 'task',
        allDay: t.dueAllDay,
        context: categoryLabel[t.category],
      })),
    ...events.map<AgendaItem>((e) => ({
      id: e.id,
      source: 'event',
      title: e.title,
      date: new Date(e.start),
      end: e.end ? new Date(e.end) : undefined,
      // Events added here count as exams by their title too ("Physics final", "ΕΞΕΤΑΣΗ ΦΥΣΙΚΗΣ").
      kind: e.kind === 'event' && isExamTitle(e.title) ? 'exam' : e.kind,
      context: e.location,
      allDay: e.allDay,
      url: e.url,
      ...asClass(e),
    })),
    ...synced.map<AgendaItem>((e) => ({
      id: e.id,
      source: 'calendar',
      title: e.title,
      date: new Date(e.start),
      end: e.end ? new Date(e.end) : undefined,
      kind: isExamTitle(e.title) ? 'exam' : 'event',
      context: e.location,
      allDay: e.allDay,
      url: e.url,
      ...asClass(e),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [storedProfile, setStoredProfile] = useLocalStorage<Profile>('unidash.profile.v1')
  const profile = storedProfile ?? { name: '' }
  const courses = useCollection<Course>('unidash.courses.v1')
  const assignments = useCollection<Assignment>('unidash.assignments.v1')
  const events = useCollection<CalendarEvent>('unidash.events.v1')
  const study = useCollection<StudySession>('unidash.study.v1')
  const examResults = useCollection<ExamResult>('unidash.examResults.v1')
  const tasks = useTasks()
  const focusSessions = useCollection<FocusSession>('unidash.focus.v1')
  const classNotes = useCollection<ClassNote>('unidash.classNotes.v1')
  const location = useHereLocation(profile.autoLocation === true)
  const weather = useWeather(location.here ?? profile.place ?? profile.home)
  const calendar = useCalendarSync(profile.calendarUrls)
  const cloud = useCloudSync(Boolean(calendar.google.account))
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [palette, setPalette] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const theme = useTheme()
  const [view, setView] = useState<ViewId>('today')
  const [toast, setToast] = useState<Toast | null>(null)
  const dismissToast = useCallback(() => setToast(null), [])
  const notify = useCallback(
    (message: string, tone: Toast['tone'] = 'default', action?: Toast['action']) => setToast({ id: Date.now(), message, tone, action }),
    [],
  )

  const focus = useFocusTimer(focusSessions, notify)

  // iPhone app: follow the website's version; tell the user once a newer one is downloaded.
  useEffect(() => startLiveUpdates(() => notify(t('app.updated'))), [notify])
  useEffect(() => dailySnapshot(), [])

  const setProfile = useCallback(
    (patch: Partial<Profile>) => setStoredProfile((p) => ({ name: '', ...p, ...patch, updatedAt: Date.now() })),
    [setStoredProfile],
  )

  // Courses follow their calendar classes' names (lib/courseLink.ts); only changes are written, so this settles.
  useEffect(() => {
    for (const { id, patch } of courseCalendarPatches(courses.items, calendar.events, profile.school)) courses.update(id, patch)
  }, [courses, calendar.events, profile.school])

  const agenda = useMemo(
    () => buildAgenda(courses.items, assignments.items, events.items, calendar.events, tasks.tasks, profile.school),
    [courses.items, assignments.items, events.items, calendar.events, tasks.tasks, profile.school],
  )

  const reminders = useReminders(agenda, courses.items, profile)
  useWidget(agenda, courses.items, profile.commute)
  // Class-note files added offline or before connecting go up to Drive once signed in.
  useClassFileUploads(classNotes, Boolean(calendar.google.account))

  const loadSample = useCallback(() => {
    const s = sampleData()
    courses.set(() => s.courses)
    assignments.set(() => s.assignments)
    events.set(() => s.events)
    tasks.replaceAll(s.tasks)
  }, [courses, assignments, events, tasks])

  const clearAll = useCallback(() => {
    courses.set(() => [])
    assignments.set(() => [])
    events.set(() => [])
    tasks.replaceAll([])
  }, [courses, assignments, events, tasks])

  const value: DashboardValue = {
    profile,
    setProfile,
    courses,
    assignments,
    events,
    study,
    examResults,
    tasks,
    focusSessions,
    classNotes,
    focus,
    focusOpen,
    setFocusOpen,
    calendar,
    cloud,
    weather,
    location,
    reminders,
    agenda,
    selectedDate,
    setSelectedDate,
    palette,
    setPalette,
    editor,
    openEditor: setEditor,
    closeEditor: () => setEditor(null),
    loadSample,
    clearAll,
    theme,
    toast,
    notify,
    dismissToast,
    view,
    setView,
  }

  return <DashboardContext value={value}>{children}</DashboardContext>
}

export function useDashboard(): DashboardValue {
  const value = use(DashboardContext)
  if (!value) throw new Error('useDashboard must be used inside <DashboardProvider>')
  return value
}
