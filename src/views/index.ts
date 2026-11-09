import { CalendarDays, CheckCircle2, ClipboardCheck, GraduationCap, Sun, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { CalendarView } from './CalendarView'
import { CoursesView } from './CoursesView'
import { ExamsView } from './ExamsView'
import { TasksView } from './TasksView'
import { TodayView } from './TodayView'
import { t } from '@/i18n'

export type ViewId = 'today' | 'courses' | 'exams' | 'tasks' | 'calendar'

export const views: Array<{ id: ViewId; label: string; icon: LucideIcon; component: ComponentType }> = [
  { id: 'today', label: t('nav.today'), icon: Sun, component: TodayView },
  { id: 'courses', label: t('nav.courses'), icon: GraduationCap, component: CoursesView },
  { id: 'exams', label: t('nav.exams'), icon: ClipboardCheck, component: ExamsView },
  { id: 'tasks', label: t('nav.tasks'), icon: CheckCircle2, component: TasksView },
  { id: 'calendar', label: t('nav.calendar'), icon: CalendarDays, component: CalendarView },
]
