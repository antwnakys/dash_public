import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useDashboard } from '@/context/DashboardContext'
import { cn } from '@/lib/cn'

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
            initial={{ opacity: 0, y: 12, scale: 0.96, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(4px)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className={cn(
              'material pointer-events-auto max-w-sm rounded-full px-4 py-2.5 text-subhead font-medium',
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
