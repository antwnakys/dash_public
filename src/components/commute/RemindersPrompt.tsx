import { BellRing, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'

const DISMISSED = 'dash.reminders.prompt.dismissed'

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED) === '1'
  } catch {
    return false
  }
}

/** One tap to turn on phone reminders, right on Today (iPhone app, until answered or dismissed). */
export function RemindersPrompt() {
  const { reminders } = useDashboard()
  const [hidden, setHidden] = useState(wasDismissed)
  if (hidden || reminders.permission !== 'prompt') return null

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      // Not remembered; it shows again next time.
    }
  }

  return (
    <div className="surface flex items-center gap-3.5 px-4 py-3.5">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
        <BellRing className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline text-ink">Get reminders on your phone</span>
        <span className="block text-subhead text-muted">When to leave for class, and before deadlines and exams.</span>
        <Button size="sm" variant="primary" className="mt-2.5" onClick={reminders.enable}>
          Turn on reminders
        </Button>
      </span>
      <button onClick={dismiss} aria-label="Not now" className="-mt-8 -mr-1 self-start rounded-full p-1.5 text-faint transition-colors hover:bg-fill hover:text-muted">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  )
}
