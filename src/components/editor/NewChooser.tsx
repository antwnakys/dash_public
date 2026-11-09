import { CalendarPlus, CheckSquare, ClipboardCheck, FileText, GraduationCap, type LucideIcon } from 'lucide-react'
import { useDashboard } from '@/context/DashboardContext'
import type { EditorTarget } from '@/types'
import { t } from '@/i18n'

const choices: Array<{ label: string; detail: string; icon: LucideIcon; target: EditorTarget }> = [
  { label: t('new.task'), detail: t('new.taskDetail'), icon: CheckSquare, target: { type: 'task' } },
  { label: t('new.exam'), detail: t('new.examDetail'), icon: ClipboardCheck, target: { type: 'exam' } },
  { label: t('new.deadline'), detail: t('new.deadlineDetail'), icon: FileText, target: { type: 'deadline' } },
  { label: t('new.event'), detail: t('new.eventDetail'), icon: CalendarPlus, target: { type: 'event' } },
  { label: t('new.course'), detail: t('new.courseDetail'), icon: GraduationCap, target: { type: 'course' } },
]

/** What the New button offers: every kind of thing dash can hold. */
export function NewChooser() {
  const { openEditor } = useDashboard()
  return (
    <ul className="surface separated -mx-1 flex flex-col overflow-hidden">
      {choices.map(({ label, detail, icon: Icon, target }) => (
        <li key={label}>
          <button
            onClick={() => openEditor(target)}
            className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-fill active:bg-fill-strong"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-accent/12 text-accent">
              <Icon aria-hidden className="size-[18px]" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-body font-medium text-ink">{label}</span>
              <span className="block text-subhead text-muted">{detail}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
