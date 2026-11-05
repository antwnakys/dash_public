export type TaskCategory = 'college' | 'personal' | 'projects'

export interface Task {
  id: string
  title: string
  category: TaskCategory
  done: boolean
  createdAt: string
  /** When it's due (ISO); with `dueAllDay` only the date counts. */
  due?: string
  dueAllDay?: boolean
}

export interface CourseLink {
  label: string
  url: string
  kind: 'portal' | 'materials' | 'video' | 'meeting'
}

/** One recurring class time: the weekdays it meets (0 = Sunday … 6 = Saturday) and its local times. */
export interface CourseMeeting {
  days: number[]
  /** "HH:MM" */
  start: string
  /** "HH:MM" */
  end?: string
}

export interface Course {
  id: string
  code: string
  name: string
  instructor: string
  /** 0–1, share of the syllabus completed */
  progress: number
  /** Readable schedule, e.g. "Tue & Thu 13:00–14:30"; written from `meetings` when they exist. */
  schedule: string
  meetings?: CourseMeeting[]
  /** First and last day of classes, "YYYY-MM-DD". */
  term?: { start?: string; end?: string }
  links: CourseLink[]
}

export interface Assignment {
  id: string
  courseId: string
  title: string
  /** ISO timestamp */
  due: string
  kind: 'assignment' | 'exam' | 'quiz'
  submitted: boolean
  /** Mark received; out of `outOf` (10 by default, the Greek scale). */
  grade?: number
  outOf?: number
}

/** One study session for an exam: planned by dash, or a tick on a study event from the calendar. */
export interface StudySession {
  /** `<examId>@<start>` for planned sessions, the calendar event id for calendar ones. */
  id: string
  examId: string
  /** ISO timestamp */
  start: string
  minutes: number
  topic?: string
  done: boolean
  fromCalendar?: boolean
}

export interface CalendarEvent {
  id: string
  title: string
  /** ISO timestamp */
  start: string
  /** ISO timestamp; synced calendar events only */
  end?: string
  allDay?: boolean
  location?: string
  /** Teams / Zoom / Meet link found in the event. */
  link?: string
  /** Any other web link in the event's notes (a practice site, slides…). */
  url?: string
  /** Taken online (says so, or has a meeting link): no trip to campus. */
  online?: boolean
  /** `exam`: an exam added in dash from + → Exam. */
  kind: 'event' | 'reminder' | 'exam'
}

/** `class`: a lesson on campus (Sorou 74, Marousi), marked as a course. */
export type AgendaKind = 'assignment' | 'exam' | 'quiz' | 'event' | 'reminder' | 'class' | 'task'

/** Assignments and events merged into one chronological stream. */
export interface AgendaItem {
  id: string
  source: 'assignment' | 'event' | 'calendar' | 'task'
  title: string
  date: Date
  /** When it ends, if known (synced calendar events). */
  end?: Date
  kind: AgendaKind
  context?: string
  allDay?: boolean
  /** The course a class belongs to, when its title matches one. */
  courseId?: string
  /** Meeting link, for online lessons. */
  link?: string
  /** Other web link from the event (shown as a button on exams). */
  url?: string
  online?: boolean
}

export interface Weather {
  location: string
  tempC: number
  highC: number
  lowC: number
  condition: 'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'
  summary: string
}

export interface Place {
  name: string
  latitude: number
  longitude: number
}

export interface Profile {
  name: string
  /** Weather location; when unset the device location is used. */
  place?: Place
  /** Follow this device's location for the weather, refreshed each time dash opens. Missing means on. */
  autoLocation?: boolean
  /** Door-to-door minutes from home to campus; unset means the default in lib/commute.ts. */
  commuteMinutes?: number
  /** Suburban departures from Doukissis Plakentias toward Pentelis ("17:11"); unset means the defaults in lib/commute.ts. */
  suburbanTrains?: string[]
  /** Phone reminders (iPhone app). Missing flags count as on. */
  reminders?: { leave?: boolean; deadlines?: boolean; metroCard?: boolean; appExpiry?: boolean }
  /** Google Calendar secret iCal addresses (or any iCal feed) to sync. */
  calendarUrls?: string[]
  /** When the profile last changed, for sync. */
  updatedAt?: number
}

/** What the editor sheet is showing. A missing id means "create new". */
export type EditorTarget =
  | { type: 'course'; id?: string }
  | { type: 'deadline'; id?: string; courseId?: string }
  | { type: 'event'; id?: string }
  | { type: 'exam'; id?: string }
  | { type: 'task'; id?: string }
  | { type: 'new' }
  | { type: 'settings'; section?: 'calendar' | 'commute' }

export type ThemePreference = 'system' | 'light' | 'dark'
