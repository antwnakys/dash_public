import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { useExamsAwaitingResult } from '@/hooks/useExams'
import { useNow } from '@/hooks/useNow'
import { t } from '@/i18n'
import { addDays, startOfDay } from '@/lib/date'
import { resultTarget } from '@/lib/exams'

const SHOW_FOR_DAYS = 3

/** On Today, for a few days after an exam: "How did Physics go?" with one tap to add the result. */
export function ExamResultPrompt() {
  const { openEditor } = useDashboard()
  const now = useNow(60_000)
  const exam = useExamsAwaitingResult(now).find((e) => e.date >= addDays(startOfDay(now), -SHOW_FOR_DAYS))
  if (!exam) return null
  return (
    <div className="surface flex items-center gap-3.5 px-4 py-3.5">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
        <ClipboardCheck className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline text-ink">{t('res.prompt', { subject: exam.subject })}</span>
        <span className="block text-subhead text-muted">{t('res.promptDetail')}</span>
        <Button size="sm" variant="primary" className="mt-2.5" onClick={() => openEditor(resultTarget(exam))}>
          {t('res.add')}
        </Button>
      </span>
    </div>
  )
}
