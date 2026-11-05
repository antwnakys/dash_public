import { motion, type Transition } from 'framer-motion'

interface LogoProps {
  className?: string
  /** Draw the mark in: the d strokes on, then the dashes rush in from the left. */
  animated?: boolean
}

const ink = 'var(--color-ink)'
const draw = (delay: number, duration = 0.5): Transition => ({ delay, duration, ease: [0.65, 0, 0.35, 1] })

export function Logo({ className, animated = false }: LogoProps) {
  const from = <T,>(initial: T) => (animated ? initial : false)
  const dash = (delay: number) => ({
    initial: from({ x: -28, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    transition: { delay, type: 'spring' as const, stiffness: 260, damping: 18 },
  })

  return (
    <svg viewBox="0 0 100 100" fill="none" strokeLinecap="round" className={className} aria-hidden>
      <g transform="translate(8 2)">
        <motion.path d="M17 46h7" stroke={ink} strokeOpacity={0.3} strokeWidth={7} {...dash(0.62)} />
        <motion.path d="M5 58h19" stroke="var(--color-accent)" strokeWidth={8} {...dash(0.5)} />
        <motion.path d="M13 70h11" stroke={ink} strokeOpacity={0.55} strokeWidth={7} {...dash(0.7)} />
        <motion.circle
          cx={56}
          cy={58}
          r={18}
          stroke={ink}
          strokeWidth={11}
          transform="rotate(-90 56 58)"
          initial={from({ pathLength: 0 })}
          animate={{ pathLength: 1 }}
          transition={draw(0, 0.55)}
        />
        <motion.path
          d="M74 76V20"
          stroke={ink}
          strokeWidth={11}
          initial={from({ pathLength: 0 })}
          animate={{ pathLength: 1 }}
          transition={draw(0.3, 0.35)}
        />
      </g>
    </svg>
  )
}
