import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { haptic } from '@/lib/native'

/** Round check: the tick draws on and a ring pops outward when completed. */
export function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        if (!checked) haptic('medium')
        onToggle()
      }}
      // 44px hit area around a 22px circle.
      className="relative -m-[11px] flex size-11 shrink-0 items-center justify-center rounded-full"
    >
      <motion.span
        className={cn(
          'absolute size-[22px] rounded-full border-[1.5px] transition-colors duration-200',
          checked ? 'border-accent-fill bg-accent-fill' : 'border-faint/70 hover:border-muted',
        )}
        animate={{ scale: checked ? [1, 0.8, 1] : 1 }}
        transition={{ duration: 0.28 }}
      />
      <AnimatePresence>
        {checked && (
          <motion.span
            key="ring"
            className="pointer-events-none absolute size-[22px] rounded-full border border-accent-fill"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.9, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <svg viewBox="0 0 16 16" className="relative size-3" aria-hidden>
        <motion.path
          d="M3.5 8.5l3 3 6-7"
          fill="none"
          stroke="var(--accent-ink)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.22, delay: checked ? 0.06 : 0 }}
        />
      </svg>
    </button>
  )
}
