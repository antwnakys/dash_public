import { AnimatePresence, motion } from 'framer-motion'
import { blur, spring } from '@/lib/motion'

/** Each digit rolls up when it changes, like a mechanical counter. */
export function RollingTime({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text} role="text">
      {[...text].map((ch, i) => (
        <span key={i} aria-hidden className="relative inline-block overflow-hidden align-bottom">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              className="inline-block"
              initial={{ y: '100%', opacity: 0, ...blur(4) }}
              animate={{ y: 0, opacity: 1, ...blur(0) }}
              exit={{ y: '-100%', opacity: 0, ...blur(4) }}
              transition={spring.smooth}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}
