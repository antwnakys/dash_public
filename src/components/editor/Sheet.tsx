import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from '@/components/ui/IconButton'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Bottom sheet on phones (drag the grabber down to close), centred dialog from 640px up. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const drag = useDragControls()
  const reduce = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog unless a field already autofocused.
    requestAnimationFrame(() => {
      if (!panel.current?.contains(document.activeElement)) panel.current?.focus()
    })
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      returnFocus.current?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-[var(--scrim)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={(_, info) => (info.offset.y > 110 || info.velocity.y > 550) && onClose()}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.42 }}
            className="material relative flex max-h-[92dvh] w-full flex-col rounded-t-[1.75rem] outline-none sm:max-w-[30rem] sm:rounded-[1.75rem]"
          >
            <div
              onPointerDown={(e) => drag.start(e)}
              className="relative flex shrink-0 touch-none items-center justify-between gap-3 px-5 pt-5 pb-3 sm:cursor-default"
            >
              <span aria-hidden className="absolute top-2 left-1/2 h-[5px] w-9 -translate-x-1/2 rounded-full bg-fill-strong sm:hidden" />
              <h2 className="text-title text-ink">{title}</h2>
              <IconButton icon={X} label="Close" variant="filled" onClick={onClose} className="size-8" />
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
