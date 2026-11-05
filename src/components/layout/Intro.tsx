import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/brand/Logo'

const SEEN = 'dash.intro.seen'

function seenThisSession() {
  try {
    return sessionStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}

/** Launch moment, once per session: the logo draws itself, then the page is revealed. */
export function Intro() {
  const reduce = useReducedMotion()
  const [visible, setVisible] = useState(() => !reduce && !seenThisSession())

  useEffect(() => {
    if (!visible) return
    try {
      sessionStorage.setItem(SEEN, '1')
    } catch {
      // Not critical.
    }
    const t = window.setTimeout(() => setVisible(false), 1050)
    return () => window.clearTimeout(t)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-bg"
          exit={{ opacity: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
        >
          <motion.div exit={{ scale: 0.85, opacity: 0, filter: 'blur(6px)', transition: { duration: 0.35 } }}>
            <Logo animated className="size-24" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
