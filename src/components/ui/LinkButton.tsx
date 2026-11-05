import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { linkLabel } from '@/lib/meeting'

/** A web link on an exam (practice site…), styled like the Join on Teams button. */
export function LinkButton({ url, compact, className }: { url: string; compact?: boolean; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-fill font-semibold text-accent-ink transition-[filter,transform] hover:brightness-110 active:scale-95',
        compact ? 'h-7 px-2.5 text-caption' : 'h-9 px-4 text-subhead',
        className,
      )}
    >
      {linkLabel(url)}
      <ArrowUpRight aria-hidden className={compact ? 'size-3.5' : 'size-4'} strokeWidth={2.4} />
    </a>
  )
}
