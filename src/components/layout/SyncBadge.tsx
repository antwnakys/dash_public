import { AnimatePresence, motion } from 'framer-motion'
import { Cloud, CloudAlert, CloudOff, RefreshCw } from 'lucide-react'
import { useDashboard } from '@/context/DashboardContext'
import { cn } from '@/lib/cn'
import { countdown } from '@/lib/date'

/** Live sync state; turns into a "Resume sync" button when Google needs a tap. */
export function SyncBadge() {
  const { cloud, calendar, notify } = useDashboard()
  if (cloud.status === 'off') return null

  const resume = async () => {
    try {
      await calendar.google.connect()
      cloud.syncNow()
      notify('Sync resumed')
    } catch {
      notify('Couldn’t reconnect to Google. Try again.', 'error')
    }
  }

  if (cloud.status === 'paused')
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.95 }}
        onClick={resume}
        className="flex h-8 items-center gap-1.5 rounded-full bg-accent/12 px-3 text-subhead font-semibold text-accent"
      >
        <CloudOff aria-hidden className="size-4" strokeWidth={2.2} />
        Resume sync
      </motion.button>
    )

  const label =
    cloud.status === 'syncing'
      ? 'Syncing…'
      : cloud.status === 'error'
        ? `Sync failed: ${cloud.error}`
        : `Synced ${cloud.lastSyncedAt ? countdown(new Date(cloud.lastSyncedAt)).replace('today', 'just now') : ''}`

  return (
    <button
      onClick={cloud.syncNow}
      aria-label={label}
      title={label}
      className={cn(
        'relative flex size-9 items-center justify-center rounded-full transition-colors hover:bg-fill',
        cloud.status === 'error' ? 'text-danger' : 'text-muted',
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={cloud.status}
          initial={{ opacity: 0, scale: 0.6, filter: 'blur(3px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.6, filter: 'blur(3px)' }}
          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          className="flex"
        >
          {cloud.status === 'syncing' ? (
            <RefreshCw aria-hidden className="size-[18px] animate-spin [animation-duration:1.4s]" strokeWidth={2} />
          ) : cloud.status === 'error' ? (
            <CloudAlert aria-hidden className="size-[18px]" strokeWidth={2} />
          ) : (
            <Cloud aria-hidden className="size-[18px]" strokeWidth={2} />
          )}
        </motion.span>
      </AnimatePresence>
      {cloud.status === 'synced' && (
        <motion.span
          aria-hidden
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5, duration: 0.4, delay: 0.1 }}
          className="absolute right-1.5 bottom-1.5 size-2 rounded-full bg-[#34c759] ring-2 ring-bg"
        />
      )}
    </button>
  )
}
