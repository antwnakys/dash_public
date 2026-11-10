import { registerPlugin } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useEffect, useState } from 'react'
import { isNative } from '@/lib/native'
import type { LookPreference, ThemePreference } from '@/types'
import { useLocalStorage } from './useLocalStorage'

/** Native side in ios/App/App/SceneDelegate.swift: matches iOS's colours behind the page to dash's theme. */
const DashTheme = registerPlugin<{ set(options: { style: ThemePreference }): Promise<void> }>('DashTheme')

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

/**
 * Light/dark preference: applied to <html data-theme> and the iOS status bar. Plus the design (`look`): Classic (the
 * default) or Obsidian, per device (not synced), applied as <html data-look="obsidian">.
 */
export function useTheme() {
  const [stored, setStored] = useLocalStorage<ThemePreference>('unidash.theme.v1')
  const preference = stored ?? 'system'
  const [systemDark, setSystemDark] = useState(() => media().matches)

  useEffect(() => {
    const m = media()
    const onChange = () => setSystemDark(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])

  const [storedLook, setStoredLook] = useLocalStorage<LookPreference>('unidash.look.v1')
  const look: LookPreference = storedLook === 'obsidian' ? 'obsidian' : 'classic'
  useEffect(() => {
    if (look === 'obsidian') document.documentElement.dataset.look = 'obsidian'
    else delete document.documentElement.dataset.look
  }, [look])

  const resolved: 'light' | 'dark' = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    const root = document.documentElement
    if (preference === 'system') delete root.dataset.theme
    else root.dataset.theme = preference
    if (isNative) {
      // Older app builds don't have DashTheme yet; that only means the native colours follow the phone.
      DashTheme.set({ style: preference }).catch(() => {})
      StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light }).catch(() => {})
    }
  }, [preference, resolved])

  return {
    preference,
    resolved,
    setPreference: (p: ThemePreference) => setStored(p),
    look: { preference: look, setPreference: (p: LookPreference) => setStoredLook(p) },
  }
}
