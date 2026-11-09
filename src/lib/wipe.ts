/**
 * Settings → Data → Delete all data: everything unidash keeps, everywhere.
 * With Google connected: the Drive copy is deleted and unidash's access to the account is revoked first;
 * if Drive can't be reached nothing is deleted, so the person can retry rather than end up half-deleted.
 * Then every unidash.* key on this device is removed and the app restarts at the first-open setup.
 */
import { googleAccessToken } from '@/data/google'
import { findFile, removeFile } from '@/sync/drive'

export async function deleteEverything(google?: { disconnect: () => Promise<void> }): Promise<void> {
  if (google) {
    const token = await googleAccessToken()
    // Disconnect first so syncing stops and can't write the file back while it's being deleted.
    await google.disconnect().catch(() => {})
    const file = await findFile(token)
    if (file) await removeFile(token, file.id)
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    }).catch(() => {})
  }
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('unidash.')) localStorage.removeItem(key)
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('unidash.')) sessionStorage.removeItem(key)
  } catch {
    // Storage unavailable: nothing is saved anyway.
  }
  location.reload()
}

/** A ready-to-send feedback message: the person's words plus what helps fix things (version, language, device). */
export function feedbackDetails(build: string, lang: string): string {
  return [`unidash ${build}`, `Language: ${lang}`, `Device: ${navigator.userAgent}`].join('\n')
}
