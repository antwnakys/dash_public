import type { Task } from '@/types'

const now = new Date().toISOString()

export const tasks: Task[] = [
  { id: 't1', title: 'Finish eigenvalue problems 4–9', category: 'college', done: false, createdAt: now },
  { id: 't2', title: 'Outline the essay argument', category: 'college', done: false, createdAt: now },
  { id: 't3', title: 'Email lab partner about data', category: 'college', done: true, createdAt: now },
  { id: 't4', title: 'Grocery run', category: 'personal', done: false, createdAt: now },
  { id: 't5', title: 'Laundry', category: 'personal', done: false, createdAt: now },
  { id: 't6', title: 'Fix the inventory bug in the side project', category: 'projects', done: false, createdAt: now },
  { id: 't7', title: 'Finish the ranked placement matches', category: 'projects', done: false, createdAt: now },
]
