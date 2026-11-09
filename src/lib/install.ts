/**
 * Offline support and "Add to Home Screen" on the website.
 * The service worker (built by build/serviceWorker.ts) keeps the app usable without a connection; it's only
 * registered in a real browser, not inside the iPhone or Mac apps, which bring their own files.
 */
import { isMacApp } from './macApp'
import { isNative } from './native'

export const isBrowser = !isNative && !isMacApp

export function registerServiceWorker() {
  if (!isBrowser || !import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // After the page has loaded, so saving the app's files never slows down the first open. The app itself starts
  // after the language file, so the page may well have finished loading already.
  const register = () => navigator.serviceWorker.register('./sw.js').catch(() => {})
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

/** Opened from the Home Screen (already installed). */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** iPhone and iPad (iPadOS reports itself as a Mac with a touch screen). */
export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Chrome and Edge on Android offer a one-tap install; the offer can arrive before the app has rendered.
let offer: InstallPromptEvent | undefined
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    offer = e as InstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    offer = undefined
    listeners.forEach((l) => l())
  })
}

export const canInstallDirectly = () => Boolean(offer)
export function onInstallOffer(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Shows the browser's own install dialog. True if the person accepted. */
export async function installApp(): Promise<boolean> {
  if (!offer) return false
  const current = offer
  offer = undefined
  await current.prompt()
  return (await current.userChoice).outcome === 'accepted'
}
