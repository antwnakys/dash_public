import { cn } from '@/lib/cn'
import { countdown, dayDiff } from '@/lib/date'

/** "in 2 days"; tinted when it's within a day. */
export function Countdown({ date, now, className }: { date: Date; now: Date; className?: string }) {
  const soon = dayDiff(now, date) <= 1
  return (
    <span
      className={cn(
        'shrink-0 text-subhead whitespace-nowrap tabular-nums',
        soon ? 'font-medium text-accent' : 'text-muted',
        className,
      )}
    >
      {countdown(date, now)}
    </span>
  )
}
