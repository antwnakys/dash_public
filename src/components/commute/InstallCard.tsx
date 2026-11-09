import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { t } from '@/i18n'
import { canInstallDirectly, installApp, isBrowser, isIos, isStandalone, onInstallOffer } from '@/lib/install'

const DISMISSED = 'unidash.install.dismissed'

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED) === '1'
  } catch {
    return false
  }
}

// Only on phones and tablets in a browser tab: on a computer the website is fine as it is.
const eligible = () => isBrowser && !isStandalone() && window.matchMedia('(pointer: coarse)').matches

/**
 * On Today, until done or dismissed: put unidash on the Home Screen so it opens like an app (and offline).
 * Android Chrome/Edge get a one-tap Install button; iPhone gets the two taps to make in the Share menu.
 */
export function InstallCard() {
  const { notify } = useDashboard()
  const [hidden, setHidden] = useState(() => wasDismissed() || !eligible())
  const [direct, setDirect] = useState(canInstallDirectly)
  useEffect(() => onInstallOffer(() => setDirect(canInstallDirectly())), [])
  if (hidden) return null

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      // Shows again next time.
    }
  }

  const install = async () => {
    if (await installApp()) {
      notify(t('install.added'))
      dismiss()
    }
  }

  const ios = isIos()
  return (
    <div className="surface flex items-center gap-3.5 px-4 py-3.5">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
        {ios ? <Share className="size-5" strokeWidth={2} /> : <Download className="size-5" strokeWidth={2} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline text-ink">{t('install.title')}</span>
        <span className="block text-subhead text-muted">{ios ? t('install.ios') : direct ? t('install.direct') : t('install.other')}</span>
        {!ios && direct && (
          <Button size="sm" variant="primary" className="mt-2.5" onClick={install}>
            {t('install.button')}
          </Button>
        )}
      </span>
      <button
        onClick={dismiss}
        aria-label={t('common.notNow')}
        className="-mt-8 -me-1 self-start rounded-full p-1.5 text-faint transition-colors hover:bg-fill hover:text-muted"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  )
}
