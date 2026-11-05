import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export const isNative = Capacitor.isNativePlatform()

/** A light tap on the iPhone's Taptic Engine; does nothing on the web. */
export function haptic(style: 'light' | 'medium' = 'light') {
  if (!isNative) return
  Haptics.impact({ style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => {})
}
