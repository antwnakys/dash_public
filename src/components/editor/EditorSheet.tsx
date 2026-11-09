import { useState } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { useDashboard } from '@/context/DashboardContext'
import type { EditorTarget } from '@/types'
import { CourseForm } from './CourseForm'
import { DeadlineForm } from './DeadlineForm'
import { EventForm } from './EventForm'
import { ExamForm } from './ExamForm'
import { NewChooser } from './NewChooser'
import { SettingsForm } from './SettingsForm'
import { Sheet } from './Sheet'
import { TaskForm } from './TaskForm'
import { t } from '@/i18n'

const titles = {
  course: [t('editor.newCourse'), t('editor.editCourse')],
  deadline: [t('editor.newDeadline'), t('editor.editDeadline')],
  event: [t('editor.newEvent'), t('editor.editEvent')],
  exam: [t('editor.newExam'), t('editor.editExam')],
} as const

const newKinds = [
  { value: 'deadline' as const, label: t('editor.deadline') },
  { value: 'event' as const, label: t('editor.event') },
]

const idOf = (t: EditorTarget) => ('id' in t ? t.id : undefined)

/** The one sheet that hosts every editor; keeps showing the last target while it animates out. */
export function EditorSheet() {
  const { editor, closeEditor } = useDashboard()
  const [shown, setShown] = useState<EditorTarget | null>(editor)
  // Creating from the agenda lets the user switch between a deadline and an event.
  const [newKind, setNewKind] = useState<'deadline' | 'event'>('deadline')

  // Adopt a newly opened target during render (React's "adjust state on prop change" pattern).
  if (editor && editor !== shown) {
    setShown(editor)
    if (editor.type === 'deadline' || editor.type === 'event') setNewKind(editor.type)
  }

  const target = shown
  const switchable = target && (target.type === 'deadline' || target.type === 'event') && !target.id
  const type = switchable ? newKind : target?.type

  const title =
    type === 'settings'
      ? t('nav.settings')
      : type === 'new'
        ? t('nav.new')
        : type === 'task'
          ? target && idOf(target) ? t('editor.editTask') : t('editor.newTask')
          : type
            ? titles[type][target && idOf(target) ? 1 : 0]
            : ''

  return (
    <Sheet open={editor !== null} title={title} onClose={closeEditor}>
      {target && (
        <div key={JSON.stringify(target)} className="flex flex-col gap-5">
          {switchable && !('courseId' in target && target.courseId) && (
            <Segmented label={t('editor.whatToAdd')} options={newKinds} value={newKind} onChange={setNewKind} block />
          )}
          {type === 'new' && <NewChooser />}
          {type === 'task' && <TaskForm id={target.type === 'task' ? target.id : undefined} onDone={closeEditor} />}
          {type === 'course' && <CourseForm id={idOf(target)} onDone={closeEditor} />}
          {type === 'deadline' && (
            <DeadlineForm
              key={newKind}
              id={idOf(target)}
              courseId={'courseId' in target ? target.courseId : undefined}
              onDone={closeEditor}
            />
          )}
          {type === 'event' && <EventForm key={newKind} id={idOf(target)} onDone={closeEditor} />}
          {type === 'exam' && <ExamForm id={idOf(target)} onDone={closeEditor} />}
          {type === 'settings' && (
            <SettingsForm onDone={closeEditor} section={target.type === 'settings' ? target.section : undefined} />
          )}
        </div>
      )}
    </Sheet>
  )
}
