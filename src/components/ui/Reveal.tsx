import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { useState, type ReactNode } from 'react'

// Each screen's entrance plays once per app session; later visits appear instantly, so switching
// tabs never feels like the page reloaded.
const played = new Set<string>()

// Blur is costly to animate on phones; they get a plain rise and fade.
const touch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

const container: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const item: Variants = {
  hidden: touch ? { opacity: 0, y: 12 } : { opacity: 0, y: 14, filter: 'blur(6px)' },
  shown: {
    opacity: 1,
    y: 0,
    ...(touch ? {} : { filter: 'blur(0px)' }),
    transition: { type: 'spring', bounce: 0, duration: 0.55 },
  },
}

/** One orchestrated entrance for a screen: children rise in, a beat apart. */
export function Reveal({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const [animate] = useState(() => {
    const first = !played.has(id)
    played.add(id)
    return first && !reduce
  })
  return (
    <motion.div variants={container} initial={animate ? 'hidden' : false} animate="shown" className={className}>
      {children}
    </motion.div>
  )
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  )
}
