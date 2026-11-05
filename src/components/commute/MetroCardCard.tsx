import { CreditCard } from 'lucide-react'
import { useState } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { cardStatus } from '@/lib/metroCard'

const dismissKey = (d: Date) => `dash.metrocard.dismissed.${d.getFullYear()}-${d.getMonth() + 1}`

const isDismissed = (d: Date) => {
  try {
    return localStorage.getItem(dismissKey(d)) === '1'
  } catch {
    return false
  }
}

/** On the 2nd and 3rd of the month: renew the monthly transport card. */
export function MetroCardCard() {
  const { profile } = useDashboard()
  const now = useNow(60_000)
  const [hidden, setHidden] = useState(() => isDismissed(now))
  const status = cardStatus(now)
  if (!status || hidden || profile.reminders?.metroCard === false) return null

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(dismissKey(now), '1')
    } catch {
      // Shows again next time.
    }
  }

  return (
    <div className="surface flex items-center gap-3.5 px-4 py-3.5">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
        <CreditCard className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline text-ink">{status === 'tomorrow' ? 'Metro card expires tomorrow' : 'Metro card expires today'}</span>
        <span className="block text-subhead text-muted">{status === 'tomorrow' ? 'Renew it today so you can travel tomorrow.' : 'Renew it before your next trip.'}</span>
      </span>
      <button
        onClick={dismiss}
        aria-label="Renewed"
        className="shrink-0 rounded-full bg-fill px-3 py-1.5 text-subhead font-medium text-ink transition-colors hover:bg-fill-strong"
      >
        Renewed
      </button>
    </div>
  )
}
