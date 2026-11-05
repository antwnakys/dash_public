/**
 * When the installed iPhone app stops opening. Apps signed with a free Apple ID run for 7 days; the date comes
 * from the app's own signing profile (native DashApp plugin in ios/App/App/SceneDelegate.swift), so it resets
 * by itself after every reinstall. Website, or app builds from before the plugin: no date.
 */
import { registerPlugin } from '@capacitor/core'
import { isNative } from './native'

const DashApp = registerPlugin<{ info(): Promise<{ expires?: string }> }>('DashApp')

export async function appExpiry(): Promise<Date | undefined> {
  if (!isNative) return undefined
  try {
    const { expires } = await DashApp.info()
    return expires ? new Date(expires) : undefined
  } catch {
    return undefined
  }
}

/** What to paste into the Claude session on the Mac to reinstall. */
export const REINSTALL_MESSAGE =
  'Install dash again on my iPhone the same way as before: download the latest https://github.com/antwnakys/dash/releases/download/ios-latest/dash-xcode.zip, unzip it into a fresh folder (replace "latest"), build with xcodebuild for my iPhone (team WDTXV8PP35, -allowProvisioningUpdates), install and open it with xcrun devicectl.'
