import type { Assignment, Course } from '@/types'
import { at } from './time'

export const courses: Course[] = [
  {
    id: 'linalg',
    code: 'MATH 221',
    name: 'Linear Algebra',
    instructor: 'Dr. Okafor',
    progress: 0.62,
    schedule: 'Mon, Wed 10:00',
    links: [
      { label: 'Course portal', url: 'https://example.edu/math221', kind: 'portal' },
      { label: 'Lecture notes', url: 'https://example.edu/math221/notes', kind: 'materials' },
    ],
  },
  {
    id: 'algo',
    code: 'CS 310',
    name: 'Algorithms & Data Structures',
    instructor: 'Prof. Lindqvist',
    progress: 0.48,
    schedule: 'Tue, Thu 13:00',
    links: [
      { label: 'Course portal', url: 'https://example.edu/cs310', kind: 'portal' },
      { label: 'Recorded lectures', url: 'https://example.edu/cs310/videos', kind: 'video' },
    ],
  },
  {
    id: 'physics',
    code: 'PHYS 150',
    name: 'Mechanics & Waves',
    instructor: 'Dr. Haddad',
    progress: 0.71,
    schedule: 'Mon, Fri 14:00',
    links: [
      { label: 'Course portal', url: 'https://example.edu/phys150', kind: 'portal' },
      { label: 'Lab manual', url: 'https://example.edu/phys150/lab', kind: 'materials' },
    ],
  },
  {
    id: 'writing',
    code: 'ENG 105',
    name: 'Academic Writing',
    instructor: 'Ms. Brennan',
    progress: 0.35,
    schedule: 'Wed 16:00',
    links: [{ label: 'Course portal', url: 'https://example.edu/eng105', kind: 'portal' }],
  },
]

export const assignments: Assignment[] = [
  { id: 'a1', courseId: 'linalg', title: 'Problem set 7: eigenvalues', due: at(1, 23, 59), kind: 'assignment', submitted: false },
  { id: 'a2', courseId: 'algo', title: 'Graph traversal lab', due: at(3, 17), kind: 'assignment', submitted: false },
  { id: 'a3', courseId: 'algo', title: 'Midterm exam', due: at(6, 9), kind: 'exam', submitted: false },
  { id: 'a4', courseId: 'physics', title: 'Pendulum lab report', due: at(2, 12), kind: 'assignment', submitted: false },
  { id: 'a5', courseId: 'physics', title: 'Quiz: oscillations', due: at(4, 14), kind: 'quiz', submitted: false },
  { id: 'a6', courseId: 'writing', title: 'Argumentative essay draft', due: at(8, 23, 59), kind: 'assignment', submitted: false },
  { id: 'a7', courseId: 'linalg', title: 'Problem set 6', due: at(-2, 23, 59), kind: 'assignment', submitted: true },
  { id: 'a8', courseId: 'linalg', title: 'Midterm exam', due: at(12, 10), kind: 'exam', submitted: false },
]
