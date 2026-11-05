/**
 * The Mac app (Tauri, `src-tauri/`) opens the live website in a window. These helpers only do
 * anything inside that window; on the web and on the iPhone they're inert.
 */

/** True inside the dash Mac app. Tauri injects `__TAURI_INTERNALS__` into every page it shows. */
export const isMacApp = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const tauriCore = () => import('@tauri-apps/api/core')
const tauriEvent = () => import('@tauri-apps/api/event')

/** Opens a web link in the Mac's default browser (Teams, practice sites, Google sign-in). */
export async function openInBrowser(url: string): Promise<void> {
  const { invoke } = await tauriCore()
  await invoke('plugin:opener|open_url', { url })
}

/**
 * A WKWebView window ignores target="_blank" links, so inside the Mac app every link to another
 * site opens in the default browser instead.
 */
export function routeExternalLinks() {
  if (!isMacApp) return
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || e.defaultPrevented) return
      const url = new URL(a.href, location.href)
      if (!/^(https?|mailto|tel):$/.test(url.protocol)) return
      if (url.origin === location.origin && a.target !== '_blank') return
      e.preventDefault()
      openInBrowser(url.href).catch(() => {})
    },
    true,
  )
  window.open = (url?: string | URL) => {
    if (url) openInBrowser(String(url)).catch(() => {})
    return null
  }
}

/** Resolves with the next dash URL macOS hands the app (the Google sign-in redirect). */
export async function nextDeepLink(matches: (url: string) => boolean, timeoutMs: number): Promise<string> {
  const { listen } = await tauriEvent()
  return new Promise((resolve, reject) => {
    let done = false
    let stop = () => {}
    const finish = () => {
      done = true
      clearTimeout(timer)
      stop()
    }
    const timer = setTimeout(() => {
      finish()
      reject(new Error('Google sign-in wasn’t finished. Try again.'))
    }, timeoutMs)
    listen<string[]>('deep-link://new-url', (event) => {
      const url = event.payload.find(matches)
      if (!url || done) return
      finish()
      resolve(url)
    }).then(
      (unlisten) => (done ? unlisten() : (stop = unlisten)),
      (e) => (finish(), reject(e)),
    )
  })
}

export type MenuBarChoice = 'new' | 'today' | 'courses' | 'exams' | 'tasks' | 'calendar'

/** Calls `onChoice` when something is picked in dash's menu bar menu (the app has already shown the window). */
export function onMenuBar(onChoice: (choice: MenuBarChoice) => void): () => void {
  if (!isMacApp) return () => {}
  let stop: (() => void) | undefined
  let gone = false
  tauriEvent()
    .then(({ listen }) => listen<MenuBarChoice>('dash://menu', (e) => onChoice(e.payload)))
    .then((unlisten) => (gone ? unlisten() : (stop = unlisten)))
    .catch(() => {})
  return () => {
    gone = true
    stop?.()
  }
}
