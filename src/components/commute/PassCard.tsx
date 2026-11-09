import { CreditCard } from 'lucide-react'
import { useState } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { passStatus } from '@/lib/pass'
import { t } from '@/i18n'

const dismissKey = (d: Date) => `unidash.pass.dismissed.${d.getFullYear()}-${d.getMonth() + 1}`

const isDismissed = (d: Date) => {
  try {
    return localStorage.getItem(dismissKey(d)) === '1'
  } catch {
    return false
  }
}

/** The day before and the day the monthly transport pass renews (only when a pass is set up). */
export function PassCard() {
  const { profile } = useDashboard()
  const now = useNow(60_000)
  const [hidden, setHidden] = useState(() => isDismissed(now))
  const day = profile.pass?.renewDay
  const status = day ? passStatus(day, now) : undefined
  if (!status || hidden) return null

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
        <span className="block text-headline text-ink">{status === 'tomorrow' ? t('pass.tomorrow') : t('pass.today')}</span>
        <span className="block text-subhead text-muted">{status === 'tomorrow' ? t('pass.tomorrowDetail') : t('pass.todayDetail')}</span>
      </span>
      <button
        onClick={dismiss}
        aria-label={t('pass.renewed')}
        className="shrink-0 rounded-full bg-fill px-3 py-1.5 text-subhead font-medium text-ink transition-colors hover:bg-fill-strong"
      >
        {t('pass.renewed')}
      </button>
    </div>
  )
}
