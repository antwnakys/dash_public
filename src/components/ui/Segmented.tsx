import { motion } from 'framer-motion'
import { useId } from 'react'
import { cn } from '@/lib/cn'

interface SegmentedProps<T extends string> {
  label: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  className?: string
  /** Stretch segments to fill the width. */
  block?: boolean
}

/** iOS-style segmented control: a raised thumb glides between options. */
export function Segmented<T extends string>({ label, options, value, onChange, className, block }: SegmentedProps<T>) {
  const layoutId = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex rounded-[0.6rem] bg-fill p-0.5', block ? 'w-full' : 'w-fit', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative h-7 rounded-[0.5rem] px-3 text-subhead font-medium whitespace-nowrap transition-colors',
              block && 'flex-1',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[0.5rem] bg-thumb shadow-[var(--shadow-thumb)]"
                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
