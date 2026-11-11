import { FileText, Image as ImageIcon, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { fmt } from '@/lib/date'
import { t } from '@/i18n'

/** A course's class notes, newest lecture first; tap one to open it, or add a note for the latest class. */
export function ClassNotesList({ courseId }: { courseId: string }) {
  const { classNotes, courses, openEditor } = useDashboard()
  const course = courses.items.find((c) => c.id === courseId)
  const notes = classNotes.items.filter((n) => n.courseId === courseId).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="flex flex-col gap-4">
      {course && <p className="px-1 text-subhead text-muted">{course.name}</p>}
      <Button variant="primary" onClick={() => openEditor({ type: 'classNote', courseId })} className="w-full">
        <Plus aria-hidden className="size-4" strokeWidth={2.4} />
        {t('notes.new')}
      </Button>
      {notes.length === 0 ? (
        <p className="px-1 text-body text-muted">{t('notes.empty')}</p>
      ) : (
        <ul className="separated overflow-hidden rounded-[var(--radius-control)] bg-fill/60">
          {notes.map((n) => {
            const photos = n.files?.filter((f) => f.type.startsWith('image/')).length ?? 0
            const others = (n.files?.length ?? 0) - photos
            return (
              <li key={n.id}>
                <button
                  onClick={() => openEditor({ type: 'classNote', courseId, id: n.id })}
                  className="flex w-full flex-col gap-0.5 px-4 py-3 text-start transition-colors hover:bg-fill"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex-1 text-body font-medium text-ink">{fmt.longDate.format(new Date(`${n.date}T12:00`))}</span>
                    {photos > 0 && (
                      <span className="inline-flex items-center gap-1 text-caption text-muted">
                        <ImageIcon aria-hidden className="size-3.5" /> {photos}
                      </span>
                    )}
                    {others > 0 && (
                      <span className="inline-flex items-center gap-1 text-caption text-muted">
                        <FileText aria-hidden className="size-3.5" /> {others}
                      </span>
                    )}
                  </span>
                  {n.text && <span className="line-clamp-2 text-subhead text-muted">{n.text}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
