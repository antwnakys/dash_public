import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { TaskCategory } from '@/types'
import { categories, categoryLabel } from './categories'

export function AddTask({ defaultCategory, onAdd }: { defaultCategory: TaskCategory; onAdd: (title: string, category: TaskCategory) => void }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<TaskCategory | null>(null)
  const chosen = category ?? defaultCategory

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd(trimmed, chosen)
    setTitle('')
  }

  return (
    <form onSubmit={submit} className="flex min-h-[3.25rem] items-center gap-3 pr-2 pl-4">
      <Plus aria-hidden className="size-[18px] shrink-0 text-accent" strokeWidth={2.4} />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task"
        aria-label="New task"
        enterKeyHint="done"
        className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder:text-faint focus:outline-none sm:text-[0.9375rem]"
      />
      <select
        value={chosen}
        onChange={(e) => setCategory(e.target.value as TaskCategory)}
        aria-label="Category"
        className="h-8 max-w-36 shrink-0 appearance-none rounded-full bg-fill px-3 text-subhead font-medium text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {categories.map((c) => (
          <option key={c} value={c}>
            {categoryLabel[c]}
          </option>
        ))}
      </select>
    </form>
  )
}
