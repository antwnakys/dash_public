import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { cn } from '@/lib/cn'
import { blur, ease, spring } from '@/lib/motion'

export function ToastHost({ onDismiss }: { onDismiss: () => void }) {
  const { toast } = useDashboard()

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(onDismiss, toast.tone === 'error' ? 5000 : 2600)
    return () => window.clearTimeout(t)
  }, [toast, onDismiss])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.25rem)] z-40 flex justify-center px-4 lg:bottom-6 lg:pl-60"
    >
      <AnimatePresence>
        {toast && (
          <motion.p
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            // Pops up from below with a little bounce; swipe it down (or sideways) to dismiss.
            initial={{ opacity: 0, y: 24, scale: 0.9, ...blur(6) }}
            animate={{ opacity: 1, y: 0, scale: 1, ...blur(0) }}
            exit={{ opacity: 0, y: 10, scale: 0.96, ...blur(4), transition: { duration: 0.2, ease: ease.out } }}
            transition={{ ...spring.bouncy, damping: 22, opacity: { duration: 0.2 } }}
            drag
            dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, info) => (info.offset.y > 30 || Math.abs(info.offset.x) > 80) && onDismiss()}
            className={cn(
              'material pointer-events-auto max-w-sm cursor-grab touch-none rounded-full px-4 py-2.5 text-subhead font-medium active:cursor-grabbing',
              toast.tone === 'error' ? 'text-danger' : 'text-ink',
            )}
          >
            {toast.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
