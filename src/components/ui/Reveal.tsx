import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { introDelay } from '@/lib/intro'
import { blur, spring } from '@/lib/motion'

// Each screen's entrance plays once per app session; later visits appear instantly, so switching
// tabs never feels like the page reloaded.
const played = new Set<string>()

const item: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985, ...blur(6) },
  shown: { opacity: 1, y: 0, scale: 1, ...blur(0), transition: { ...spring.gentle, opacity: { duration: 0.4 } } },
}

/**
 * One orchestrated entrance for a screen: children rise in, a beat apart, starting as the launch
 * logo clears (or right away when it isn't playing).
 */
export function Reveal({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const [plan] = useState(() => {
    const first = !played.has(id)
    played.add(id)
    // Start a little before the logo has fully gone, so the two overlap into one motion.
    return { animate: first && !reduce, delay: Math.max(0.04, introDelay() - 0.25) }
  })
  return (
    <motion.div
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.07, delayChildren: plan.delay } } }}
      initial={plan.animate ? 'hidden' : false}
      animate="shown"
      className={className}
    >
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
