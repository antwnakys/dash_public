import { motion } from 'framer-motion'
import { Plus, Settings } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { cn } from '@/lib/cn'
import { views } from '@/views'

const item =
  'group relative flex h-9 w-full items-center gap-3 rounded-[0.65rem] px-2.5 text-body transition-colors duration-150'

/** Floating glass sidebar for screens 1024px and wider. */
export function Sidebar() {
  const { view, setView, openEditor } = useDashboard()

  return (
    <nav
      aria-label="Sections"
      className="material fixed inset-y-3 left-3 z-20 hidden w-56 flex-col rounded-[1.5rem] p-3 lg:flex"
    >
      <div className="flex items-center gap-2 px-2 pt-1 pb-5">
        <Logo className="size-7" />
        <span className="text-headline tracking-tight text-ink">dash</span>
      </div>

      <Button variant="primary" onClick={() => openEditor({ type: 'new' })} className="mb-4 w-full" title="New (N)">
        <Plus aria-hidden className="size-4" strokeWidth={2.4} />
        New
      </Button>

      <ul className="flex flex-col gap-0.5">
        {views.map(({ id, label, icon: Icon }, i) => {
          const active = id === view
          return (
            <li key={id}>
              <button
                onClick={() => setView(id)}
                aria-current={active ? 'page' : undefined}
                title={`${label} (${i + 1})`}
                className={cn(item, active ? 'font-semibold text-ink' : 'text-muted hover:bg-fill hover:text-ink')}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-[0.65rem] bg-fill-strong"
                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                  />
                )}
                <Icon aria-hidden className={cn('relative size-[18px]', active && 'text-accent')} strokeWidth={2} />
                <span className="relative">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <button onClick={() => openEditor({ type: 'settings' })} className={cn(item, 'mt-auto text-muted hover:bg-fill hover:text-ink')}>
        <Settings aria-hidden className="size-[18px]" strokeWidth={2} />
        Settings
      </button>
    </nav>
  )
}
