import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { INTRO_MS, introPlanned, markIntroSeen, skipIntro } from '@/lib/intro'
import { blur, ease } from '@/lib/motion'

/**
 * Launch moment, once per session: the logo draws itself, then lifts towards you and dissolves while the
 * page rises in behind it (screens wait for it; see lib/intro.ts).
 */
export function Intro({ skip }: { skip?: boolean }) {
  const [visible, setVisible] = useState(() => {
    if (skip) skipIntro()
    return !skip && introPlanned()
  })

  useEffect(() => {
    if (!visible) return
    markIntroSeen()
    const t = window.setTimeout(() => setVisible(false), INTRO_MS)
    return () => window.clearTimeout(t)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-bg"
          exit={{ opacity: 0, transition: { duration: 0.45, ease: ease.out } }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.35, ease: ease.out } }}
            exit={{ scale: 1.35, opacity: 0, ...blur(10), transition: { duration: 0.45, ease: ease.inOut } }}
          >
            <Logo animated className="size-24" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
