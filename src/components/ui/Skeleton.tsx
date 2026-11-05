import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block rounded-md bg-[linear-gradient(90deg,var(--fill)_25%,var(--fill-strong)_50%,var(--fill)_75%)] bg-[length:200%_100%] [animation:shimmer_1.4s_linear_infinite]',
        className,
      )}
    />
  )
}
