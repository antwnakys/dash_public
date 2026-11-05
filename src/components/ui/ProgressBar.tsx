import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'

// Fill-in animation only right after launch; afterwards bars and rings appear at their value.
let launching = true
if (typeof window !== 'undefined') window.setTimeout(() => (launching = false), 2500)

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 overflow-hidden rounded-full bg-fill', className)}
    >
      <motion.div
        className="h-full rounded-full bg-accent-fill"
        initial={launching ? { width: 0 } : false}
        animate={{ width: `${pct}%` }}
        transition={{ ...spring.gentle, delay: 0.25 }}
      />
    </div>
  )
}

/** Compact circular progress for list rows. */
export function ProgressRing({ value, label, size = 28 }: { value: number; label: string; size?: number }) {
  const pct = Math.min(1, Math.max(0, value))
  const r = (size - 4) / 2
  const c = 2 * Math.PI * r
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label}: ${Math.round(pct * 100)}%`}
      className="shrink-0 -rotate-90"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-strong)" strokeWidth={3} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent-fill)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={launching ? { strokeDashoffset: c } : false}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ ...spring.gentle, delay: 0.3 }}
      />
    </svg>
  )
}
