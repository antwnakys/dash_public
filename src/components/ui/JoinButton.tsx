import { Video } from 'lucide-react'
import { cn } from '@/lib/cn'
import { meetingName } from '@/lib/meeting'

/** "Join on Teams": opens the lesson's meeting link (in the Teams app on iPhone, when installed). */
export function JoinButton({ url, compact, className }: { url: string; compact?: boolean; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#5b5fc7] font-semibold text-white transition-[filter,transform] hover:brightness-110 active:scale-95',
        compact ? 'h-7 px-2.5 text-caption' : 'h-9 px-4 text-subhead',
        className,
      )}
    >
      <Video aria-hidden className={compact ? 'size-3.5' : 'size-4'} strokeWidth={2.2} />
      {compact ? 'Join' : `Join on ${meetingName(url)}`}
    </a>
  )
}
