import { useEffect, useState, type ReactNode } from 'react'
import { t } from '@/i18n'
import { Button } from './Button'

/**
 * A delete button that asks for a second press instead of a browser pop-up (the Mac app's window ignores those, so a
 * `confirm()` there silently cancels). First press: "Press again to delete" for a few seconds; second press: runs.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = t('confirm.again'),
  size,
  className,
}: {
  onConfirm: () => void
  children: ReactNode
  confirmLabel?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(t)
  }, [armed])
  return (
    <Button
      variant="danger"
      size={size}
      className={armed ? `${className ?? ''} bg-danger! text-white! hover:bg-danger!` : className}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
      aria-live="polite"
    >
      {armed ? confirmLabel : children}
    </Button>
  )
}
