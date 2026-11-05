import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { haptic } from '@/lib/native'

const TRIGGER = 72

/** Rubber-band resistance: the further past the edge, the less the indicator follows. */
const rubberband = (d: number) => (d * 120 * 0.55) / (120 + 0.55 * d)

/** Pull down from the top of the page to sync. Touch devices only. */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const pull = useMotionValue(0)
  const [busy, setBusy] = useState(false)
  const start = useRef<number | null>(null)
  const armed = useRef(false)
  const refresh = useRef(onRefresh)
  useEffect(() => {
    refresh.current = onRefresh
  }, [onRefresh])
  const rotate = useTransform(pull, [0, TRIGGER], [0, 270])
  const opacity = useTransform(pull, [0, 24, TRIGGER], [0, 0.6, 1])
  const scale = useTransform(pull, [0, TRIGGER], [0.6, 1])

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || busy || document.body.style.overflow === 'hidden') return
      start.current = e.touches[0].clientY
      armed.current = false
    }
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return
      // Ignore ordinary scrolling: the page must still be at the top, and the pull must be deliberate.
      if (window.scrollY > 0) {
        start.current = null
        return pull.set(0)
      }
      const d = e.touches[0].clientY - start.current - 10
      if (d <= 0) return pull.set(0)
      const v = rubberband(d)
      pull.set(v)
      if (v >= TRIGGER && !armed.current) {
        armed.current = true
        haptic()
      } else if (v < TRIGGER) armed.current = false
    }
    const onEnd = async () => {
      if (start.current === null) return
      start.current = null
      if (pull.get() >= TRIGGER) {
        setBusy(true)
        animate(pull, TRIGGER * 0.8, { type: 'spring', bounce: 0, duration: 0.3 })
        await refresh.current().catch(() => {})
        setBusy(false)
      }
      animate(pull, 0, { type: 'spring', bounce: 0, duration: 0.35 })
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [busy, pull])

  return (
    <motion.div
      aria-hidden
      style={{ y: pull, opacity }}
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)-2.25rem)] z-30 flex justify-center"
    >
      <motion.span style={{ scale }} className="material flex size-9 items-center justify-center rounded-full text-accent">
        <motion.span style={busy ? undefined : { rotate }} className={busy ? 'animate-spin' : undefined}>
          <RefreshCw className="size-4" strokeWidth={2.4} />
        </motion.span>
      </motion.span>
    </motion.div>
  )
}
