import { isMacApp } from './macApp'

/**
 * Hand a file to the person: the share sheet on iPhone/Safari ("Save to Files"), a download in browsers, the clipboard
 * in the Mac app (its window can't download). Returns how it went, for the toast.
 */
export async function saveFile(name: string, text: string, type: string): Promise<'shared' | 'downloaded' | 'copied' | 'cancelled'> {
  const file = new File([text], name, { type })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    }
    if (!isMacApp && 'download' in HTMLAnchorElement.prototype) {
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      return 'downloaded'
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
