import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sampleData } from '@/data/sample'
import { useCalendarSync, type CalendarSync } from '@/hooks/useCalendarSync'
import { useCloudSync, type CloudSync } from '@/hooks/useCloudSync'
import { useCollection, type Collection } from '@/hooks/useCollection'
import { useAppExpiry } from '@/hooks/useAppExpiry'
import { useHereLocation } from '@/hooks/useHereLocation'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useReminders, type RemindersState } from '@/hooks/useReminders'
import { useTasks, type TasksApi } from '@/hooks/useTasks'
import { useTheme } from '@/hooks/useTheme'
import { useWeather, type WeatherState } from '@/hooks/useWeather'
import { isClass, isExamTitle, matchCourse } from '@/lib/campus'
import { looksOnline } from '@/lib/meeting'
import { startOfDay } from '@/lib/date'
import { startLiveUpdates } from '@/lib/liveUpdate'
import type { ViewId } from '@/views'
import type { AgendaItem, Assignment, CalendarEvent, Course, EditorTarget, Place, Profile, StudySession, Task, ThemePreference } from '@/types'
import { categoryLabel } from '@/components/tasks/categories'

export interface Toast {
  id: number
  message: string
  tone?: 'default' | 'error'
}

interface DashboardValue {
  profile: Profile
  setProfile: (patch: Partial<Profile>) => void
  courses: Collection<Course>
  assignments: Collection<Assignment>
  events: Collection<CalendarEvent>
  /** Study sessions planned by dash, and ticks on study events from the calendar. */
  study: Collection<StudySession>
  tasks: TasksApi
  calendar: CalendarSync
  /** Syncs this device's data with every other device signed in to the same Google account. */
  cloud: CloudSync
  weather: WeatherState
  /** This device's current location (when following it) and whether location was refused. */
  location: { here?: Place; denied: boolean }
  /** When the installed iPhone app stops opening (free Apple ID signing), if known. */
  appExpires?: Date
  /** Phone reminders for leaving and for deadlines (iPhone app). */
  reminders: RemindersState
  /** Open assignments and events in one chronological list. */
  agenda: AgendaItem[]
  selectedDate: Date
  setSelectedDate: (d: Date) => void
  editor: EditorTarget | null
  openEditor: (target: EditorTarget) => void
  closeEditor: () => void
  loadSample: () => void
  clearAll: () => void
  theme: { preference: ThemePreference; resolved: 'light' | 'dark'; setPreference: (p: ThemePreference) => void }
  toast: Toast | null
  /** Brief confirmation or error shown above the navigation. */
  notify: (message: string, tone?: Toast['tone']) => void
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
): AgendaItem[] {
  const courseCode = new Map(courses.map((c) => [c.id, c.code]))
  // Events at campus (Sorou 74, Marousi) are classes: marked as a course and linked to one when the title matches.
  const asClass = (e: CalendarEvent): Partial<AgendaItem> | null => {
    if (!isClass(e)) return null
    const course = matchCourse(e.title, courses)
    const link = e.link ?? course?.links.find((l) => l.kind === 'meeting')?.url
    const online = e.online || looksOnline(e.link, e.title) || undefined
    return {
      kind: 'class',
      // "ACADEMIC SKILLS/ONLINE" reads as the course it belongs to: "Academic Skills".
      title: online ? (course?.name ?? e.title.replace(/\s*[/(–-]?\s*online\s*\)?\s*$/i, '')) : e.title,
      courseId: course?.id,
      link: online ? link : e.link,
      online,
      context: [course?.code, online ? 'Online' : e.location?.split(',')[0]].filter(Boolean).join(' · '),
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
      // Events added in dash count as exams by their title too ("ΕΞΕΤΑΣΗ ΣΗΜΑΤΑ").
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
  const [storedProfile, setStoredProfile] = useLocalStorage<Profile>('dash.profile.v1')
  const profile = storedProfile ?? { name: '' }
  const courses = useCollection<Course>('dash.courses.v1')
  const assignments = useCollection<Assignment>('dash.assignments.v1')
  const events = useCollection<CalendarEvent>('dash.events.v1')
  const study = useCollection<StudySession>('dash.study.v1')
  const tasks = useTasks()
  const location = useHereLocation(profile.autoLocation !== false)
  const weather = useWeather(location.here ?? profile.place)
  const calendar = useCalendarSync(profile.calendarUrls)
  const cloud = useCloudSync(Boolean(calendar.google.account))
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const theme = useTheme()
  const [view, setView] = useState<ViewId>('today')
  const [toast, setToast] = useState<Toast | null>(null)
  const dismissToast = useCallback(() => setToast(null), [])
  const notify = useCallback((message: string, tone: Toast['tone'] = 'default') => setToast({ id: Date.now(), message, tone }), [])

  // iPhone app: follow the website's version; tell the user once a newer one is downloaded.
  useEffect(() => startLiveUpdates(() => notify('Update downloaded. It applies when you next open dash.')), [notify])

  const setProfile = useCallback(
    (patch: Partial<Profile>) => setStoredProfile((p) => ({ name: '', ...p, ...patch, updatedAt: Date.now() })),
    [setStoredProfile],
  )

  const agenda = useMemo(
    () => buildAgenda(courses.items, assignments.items, events.items, calendar.events, tasks.tasks),
    [courses.items, assignments.items, events.items, calendar.events, tasks.tasks],
  )

  const appExpires = useAppExpiry()
  const reminders = useReminders(agenda, courses.items, profile, appExpires)

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
    tasks,
    calendar,
    cloud,
    weather,
    appExpires,
    location,
    reminders,
    agenda,
    selectedDate,
    setSelectedDate,
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
