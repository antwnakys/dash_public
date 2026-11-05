import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SectionProps {
  title: string
  /** Quiet supporting text after the title, e.g. a count. */
  meta?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}

/** A titled group: heading sits on the page, content goes in a surface below it. */
export function Section({ title, meta, action, className, children }: SectionProps) {
  return (
    <section aria-label={title} className={cn('flex min-w-0 flex-col gap-3', className)}>
      <header className="flex min-h-9 items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-title whitespace-nowrap text-ink">{title}</h2>
          {meta && <span className="truncate text-subhead text-muted">{meta}</span>}
        </div>
        {action && <div className="-mr-1.5 flex shrink-0 items-center">{action}</div>}
      </header>
      {children}
    </section>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('surface overflow-hidden', className)}>{children}</div>
}
