import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { ease, spring } from '@/lib/motion'
import { haptic } from '@/lib/native'

/**
 * Round check. Completing: the circle sinks under your finger, the blue fill springs out from the middle,
 * the tick draws on and a soft ring ripples outward. Un-ticking just drains the fill away.
 */
export function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        if (!checked) haptic('medium')
        onToggle()
      }}
      whileTap={{ scale: 0.82 }}
      transition={spring.bouncy}
      // 44px hit area around a 22px circle.
      className="relative -m-[11px] flex size-11 shrink-0 items-center justify-center rounded-full"
    >
      <span
        className={cn(
          'absolute size-[22px] rounded-full border-[1.5px] transition-colors duration-200',
          checked ? 'border-accent-fill' : 'border-faint/70 hover:border-muted',
        )}
      />
      <motion.span
        aria-hidden
        className="absolute size-[22px] rounded-full bg-accent-fill"
        initial={false}
        animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={checked ? spring.bouncy : { duration: 0.18, ease: ease.out }}
      />
      <AnimatePresence>
        {checked && (
          <motion.span
            key="ring"
            className="pointer-events-none absolute size-[22px] rounded-full border-2 border-accent-fill"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2.1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: ease.out }}
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
          transition={{ pathLength: { duration: 0.28, delay: checked ? 0.08 : 0, ease: ease.out }, opacity: { duration: 0.1, delay: checked ? 0.08 : 0 } }}
        />
      </svg>
    </motion.button>
  )
}
