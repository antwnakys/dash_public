import type { CalendarEvent } from '@/types'
import { at } from './time'

export const events: CalendarEvent[] = [
  { id: 'e1', title: 'Study group: linear algebra', start: at(0, 19), location: 'Library, room 3B', kind: 'event' },
  { id: 'e2', title: 'Call home', start: at(1, 20), kind: 'reminder' },
  { id: 'e3', title: 'Dentist', start: at(2, 9, 30), location: 'Riverside Clinic', kind: 'event' },
  { id: 'e4', title: 'Game night', start: at(4, 21), kind: 'event' },
  { id: 'e5', title: 'Renew bus pass', start: at(5, 0), allDay: true, kind: 'reminder' },
  { id: 'e6', title: 'Hackathon kickoff', start: at(9, 18), location: 'Engineering hall', kind: 'event' },
]
