import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.antwnakys.dash',
  appName: 'dash',
  webDir: 'dist',
  backgroundColor: '#0b0d12',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0b0d12',
    scrollEnabled: true,
  },
  plugins: {
    // Route fetch through native HTTP so calendar feeds without CORS headers can be read.
    CapacitorHttp: { enabled: true },
    // The web intro animation takes over straight from the native splash.
    SplashScreen: { launchShowDuration: 300, launchAutoHide: true, backgroundColor: '#0b0d12', showSpinner: false },
    StatusBar: { style: 'DARK', overlaysWebView: true },
    // Live updates from the website, driven by src/lib/liveUpdate.ts: no Capgo cloud, no update checks or stats sent elsewhere.
    CapacitorUpdater: { autoUpdate: false, statsUrl: '', appReadyTimeout: 10000 },
  },
}

export default config
