import { CalendarDays, CheckCircle2, ClipboardCheck, GraduationCap, Sun, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { CalendarView } from './CalendarView'
import { CoursesView } from './CoursesView'
import { ExamsView } from './ExamsView'
import { TasksView } from './TasksView'
import { TodayView } from './TodayView'

export type ViewId = 'today' | 'courses' | 'exams' | 'tasks' | 'calendar'

export const views: Array<{ id: ViewId; label: string; icon: LucideIcon; component: ComponentType }> = [
  { id: 'today', label: 'Today', icon: Sun, component: TodayView },
  { id: 'courses', label: 'Courses', icon: GraduationCap, component: CoursesView },
  { id: 'exams', label: 'Exams', icon: ClipboardCheck, component: ExamsView },
  { id: 'tasks', label: 'Tasks', icon: CheckCircle2, component: TasksView },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, component: CalendarView },
]
