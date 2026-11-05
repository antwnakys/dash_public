/**
 * Keeps the iPhone app on the same version as the website.
 *
 * Every deploy publishes the built site as app-bundle.zip plus version.json (see .github/workflows/deploy.yml).
 * The app checks version.json when it opens and when it comes back to the foreground; when the website runs a
 * different build, it downloads that bundle (checked against its SHA-256) and switches to it the next time the
 * app goes to the background. Data in local storage is untouched: the app keeps the same origin.
 * If a new bundle fails to start, the updater rolls back to the previous one on its own.
 */
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { isNative } from './native'

const SITE = 'https://antwnakys.github.io/dash/'
const EVERY = 10 * 60_000

export const BUILD = __BUILD__
export const BUILT_AT = new Date(__BUILT_AT__)

interface RemoteVersion {
  version: string
  url: string
  checksum: string
}

let lastCheck = 0
let busy = false

async function check(onReady: () => void) {
  if (busy || Date.now() - lastCheck < EVERY) return
  busy = true
  lastCheck = Date.now()
  try {
    const res = await fetch(`${SITE}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const remote = (await res.json()) as RemoteVersion
    if (!remote.version || !remote.checksum || remote.version === BUILD) return

    const { bundles } = await CapacitorUpdater.list()
    // A version that failed to start before is not tried again.
    if (bundles.some((b) => b.version === remote.version && b.status === 'error')) return
    const bundle =
      bundles.find((b) => b.version === remote.version && (b.status === 'pending' || b.status === 'success')) ??
      (await CapacitorUpdater.download({ url: new URL(remote.url, SITE).href, version: remote.version, checksum: remote.checksum }))
    await CapacitorUpdater.next({ id: bundle.id })
    onReady()
  } catch {
    // Offline or the site is mid-deploy: try again on the next check.
  } finally {
    busy = false
  }
}

/** Confirms this bundle started fine, then watches the website for newer versions. No-op on the web. */
export function startLiveUpdates(onReady: () => void): () => void {
  if (!isNative) return () => {}
  // Must happen within 10 s of launch, or the updater treats this bundle as broken and rolls back.
  CapacitorUpdater.notifyAppReady().catch(() => {})
  const run = () => document.visibilityState === 'visible' && check(onReady)
  run()
  document.addEventListener('visibilitychange', run)
  return () => document.removeEventListener('visibilitychange', run)
}
