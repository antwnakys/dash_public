import { Copy, Laptop } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { useNow } from '@/hooks/useNow'
import { REINSTALL_MESSAGE } from '@/lib/appExpiry'
import { cn } from '@/lib/cn'
import { dayDiff, fmt } from '@/lib/date'

const SHOW_DAYS = 2

/** In the app's last two days: when it stops opening, and the message to paste on the Mac to reinstall. */
export function AppExpiryCard() {
  const { appExpires, notify } = useDashboard()
  const now = useNow(60_000)
  if (!appExpires || appExpires <= now) return null
  const days = dayDiff(now, appExpires)
  if (days > SHOW_DAYS) return null

  const when = days === 0 ? `today at ${fmt.time.format(appExpires)}` : days === 1 ? `tomorrow at ${fmt.time.format(appExpires)}` : `on ${fmt.shortDate.format(appExpires)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(REINSTALL_MESSAGE)
      notify('Copied. Paste it in the Claude session on your Mac.')
    } catch {
      notify('Couldn’t copy. The message is in your chat with Claude.', 'error')
    }
  }

  return (
    <div className="surface flex items-center gap-3.5 px-4 py-3.5">
      <span
        aria-hidden
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', days === 0 ? 'bg-danger/14 text-danger' : 'bg-accent/12 text-accent')}
      >
        <Laptop className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline text-ink">dash stops opening {when}</span>
        <span className="block text-subhead text-muted">Reinstall from your Mac to keep it working. It takes about a minute.</span>
        <Button size="sm" variant="primary" className="mt-2.5" onClick={copy}>
          <Copy aria-hidden className="size-4" strokeWidth={2.2} />
          Copy Mac message
        </Button>
      </span>
    </div>
  )
}
