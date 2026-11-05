import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useDashboard } from '@/context/DashboardContext'
import { useScrollState } from '@/hooks/useScrollState'
import { cn } from '@/lib/cn'
import { spring } from '@/lib/motion'
import { haptic } from '@/lib/native'
import { views } from '@/views'

/** Floating tab bar with a separate New button, within thumb reach. Below 1024px. */
export function TabBar() {
  const { view, setView, openEditor } = useDashboard()
  // Scrolling down slims the bar to icons; scrolling up brings the labels back.
  const { down: compact } = useScrollState()

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-3 lg:hidden">
      <div className="pointer-events-auto flex w-full max-w-[28rem] items-center gap-2.5">
        <motion.nav
          aria-label="Sections"
          animate={{ height: compact ? 52 : 60 }}
          transition={spring.smooth}
          className="material flex flex-1 items-center rounded-full p-1"
        >
          {views.map(({ id, label, icon: Icon }) => {
            const active = id === view
            return (
              <button
                key={id}
                onClick={() => {
                  if (!active) haptic()
                  setView(id)
                }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors',
                  active ? 'text-accent' : 'text-muted active:text-ink',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute inset-0 rounded-full bg-fill"
                    transition={{ ...spring.snappy, damping: 28 }}
                  />
                )}
                {/* The icon you pick springs up from slightly small, so the tap feels answered. */}
                <motion.span
                  key={active ? 'on' : 'off'}
                  className="relative flex"
                  initial={active ? { scale: 0.72, y: 3 } : false}
                  animate={{ scale: 1, y: 0 }}
                  transition={spring.bouncy}
                >
                  <Icon aria-hidden className="size-[21px]" strokeWidth={active ? 2.2 : 1.9} />
                </motion.span>
                <motion.span
                  animate={{ opacity: compact ? 0 : 1, height: compact ? 0 : 'auto' }}
                  transition={spring.smooth}
                  className="relative overflow-hidden text-[0.65rem] font-medium tracking-[0.01em]"
                >
                  {label}
                </motion.span>
              </button>
            )
          })}
        </motion.nav>
        <motion.button
          whileTap={{ scale: 0.88 }}
          transition={spring.bouncy}
          onClick={() => {
            haptic()
            openEditor({ type: 'new' })
          }}
          aria-label="New"
          animate={{ width: compact ? 52 : 60, height: compact ? 52 : 60 }}
          className="material flex shrink-0 items-center justify-center rounded-full text-accent"
        >
          <Plus aria-hidden className="size-6" strokeWidth={2.4} />
        </motion.button>
      </div>
    </div>
  )
}
