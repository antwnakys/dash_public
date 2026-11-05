import { motion, useScroll, useTransform } from 'framer-motion'
import { Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from '@/components/ui/IconButton'
import { RevealItem } from '@/components/ui/Reveal'
import { useDashboard } from '@/context/DashboardContext'
import { SyncBadge } from './SyncBadge'

interface PageHeaderProps {
  title: ReactNode
  /** Plain-text title for the compact bar that appears on scroll. */
  shortTitle: string
  /** Small line above the title (date, context). */
  eyebrow?: ReactNode
  /** Sits on the right of the eyebrow row, e.g. weather. */
  accessory?: ReactNode
  /** Desktop-only control beside the title. */
  aside?: ReactNode
  /** One calm line under the title. */
  summary?: ReactNode
}

export function PageHeader({ title, shortTitle, eyebrow, accessory, aside, summary }: PageHeaderProps) {
  const { openEditor } = useDashboard()
  const { scrollY } = useScroll()
  // iOS-style large title: as it scrolls away, a compact bar fades in on phones.
  const barOpacity = useTransform(scrollY, [56, 96], [0, 1])
  const barVisibility = useTransform(barOpacity, (o) => (o < 0.01 ? 'hidden' : 'visible'))
  const titleScale = useTransform(scrollY, [-120, 0], [1.08, 1])

  return (
    <>
      {createPortal(
      <motion.div
        aria-hidden
        style={{ opacity: barOpacity, visibility: barVisibility }}
        className="material pointer-events-none fixed inset-x-0 top-0 z-20 flex h-[calc(env(safe-area-inset-top)+2.75rem)] items-end justify-center rounded-none pb-2.5 shadow-none lg:hidden"
      >
        <span className="text-headline text-ink">{shortTitle}</span>
      </motion.div>,
        document.body,
      )}

      <header className="flex flex-col pb-7 lg:pb-9">
        <RevealItem className="flex min-h-9 items-center justify-between gap-3">
          <div className="min-w-0 truncate text-subhead font-medium text-muted">{eyebrow}</div>
          <div className="-mr-1.5 flex shrink-0 items-center gap-0.5">
            {accessory}
            <SyncBadge />
            <IconButton icon={Settings} label="Settings" onClick={() => openEditor({ type: 'settings' })} className="lg:hidden" />
          </div>
        </RevealItem>
        <RevealItem className="mt-1 flex items-end justify-between gap-6">
          <motion.h1 style={{ scale: titleScale }} className="min-w-0 origin-left text-large-title text-ink lg:text-[2.75rem]">
            {title}
          </motion.h1>
          {aside && <div className="hidden shrink-0 lg:block">{aside}</div>}
        </RevealItem>
        {summary && (
          <RevealItem>
            <p className="mt-2.5 max-w-[42rem] text-body text-muted lg:text-[1.0625rem]">{summary}</p>
          </RevealItem>
        )}
      </header>
    </>
  )
}
