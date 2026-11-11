/**
 * Files on class notes. The note itself (text, file names) syncs like everything else; file bytes are too big for the
 * sync file, so each one is kept:
 * - on this device, in IndexedDB (`unidash-files`), as a data URL;
 * - in the user's Google Drive app folder (hidden, readable only by unidash), as text, once signed in. Text because the
 *   iPhone app sends requests through native HTTP, which carries strings unchanged.
 * Another device fetches a file from Drive the first time it's opened. Photos are shrunk to 2000 px JPEG first.
 */
import { googleAccessToken } from '@/data/google'
import { uid } from './id'
import type { NoteFile } from '@/types'

export const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_PHOTO_SIDE = 2000
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const DB_NAME = 'unidash-files'
/** Drive name prefix of a note file in the app folder. */
const PREFIX = 'unidash-file-'

// ---- This device (IndexedDB) ----

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('files')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = run(d.transaction('files', mode).objectStore('files'))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const localFile = (id: string) => tx<string | undefined>('readonly', (s) => s.get(id) as IDBRequest<string | undefined>)
const saveLocal = (id: string, data: string) => tx('readwrite', (s) => s.put(data, id))
const removeLocal = (id: string) => tx('readwrite', (s) => s.delete(id))

// ---- Preparing a picked file ----

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

/** Photos (not GIFs) become a JPEG no larger than 2000 px a side, which keeps a board photo well under 1 MB. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return readAsDataUrl(file)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export class FileTooBigError extends Error {}

/** Stores a picked file on this device and returns its entry for the note (upload to Drive happens after). */
export async function addFile(file: File): Promise<NoteFile> {
  const photo = file.type.startsWith('image/') && file.type !== 'image/gif'
  const data = photo ? await shrinkPhoto(file) : await readAsDataUrl(file)
  const size = Math.round((data.length - data.indexOf(',') - 1) * 0.75)
  if (size > MAX_FILE_BYTES) throw new FileTooBigError(file.name)
  const id = uid()
  await saveLocal(id, data)
  const name = photo && !/\.jpe?g$/i.test(file.name) ? `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg` : file.name || 'file'
  return { id, name, type: photo ? 'image/jpeg' : file.type || 'application/octet-stream', size }
}

// ---- Google Drive app folder ----

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await googleAccessToken()
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`Drive ${res.status}`)
  return res
}

/** Uploads a file that's on this device; returns its Drive id. */
export async function uploadFile(file: NoteFile): Promise<string | undefined> {
  const data = await localFile(file.id)
  if (!data) return undefined
  const boundary = `unidash${Date.now()}`
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: `${PREFIX}${file.id}`, parents: ['appDataFolder'] }) +
    `\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\n${data}\r\n--${boundary}--`
  const res = await call(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return ((await res.json()) as { id: string }).id
}

/** The file as a data URL: from this device, else from Drive (then kept here too). */
export async function openFile(file: NoteFile): Promise<string | undefined> {
  const here = await localFile(file.id).catch(() => undefined)
  if (here) return here
  if (!file.driveId) return undefined
  const data = await (await call(`${API}/files/${file.driveId}?alt=media`)).text()
  if (!data.startsWith('data:')) return undefined
  await saveLocal(file.id, data).catch(() => {})
  return data
}

/** Removes a file from this device and from Drive (best effort: a leftover in the hidden folder does no harm). */
export async function deleteFile(file: NoteFile, signedIn: boolean) {
  await removeLocal(file.id).catch(() => {})
  if (signedIn && file.driveId) await call(`${API}/files/${file.driveId}`, { method: 'DELETE' }).catch(() => {})
}

export function dataUrlToFile(data: string, name: string): File {
  const [head, b64] = data.split(',')
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type })
}

export const sizeLabel = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

/**
 * Delete all data: every note file in Drive's app folder (with `token`, while still allowed) and on this device.
 * Throws if Drive can't be reached, so nothing is half-deleted.
 */
export async function deleteAllFiles(token?: string) {
  if (token) {
    const auth = { Authorization: `Bearer ${token}` }
    let page: string | undefined
    do {
      const q = new URLSearchParams({ spaces: 'appDataFolder', q: `name contains '${PREFIX}' and trashed=false`, fields: 'nextPageToken,files(id)', pageSize: '100' })
      if (page) q.set('pageToken', page)
      const res = await fetch(`${API}/files?${q}`, { headers: auth })
      if (!res.ok) throw new Error(`Drive ${res.status}`)
      const body = (await res.json()) as { nextPageToken?: string; files: { id: string }[] }
      for (const f of body.files) await fetch(`${API}/files/${f.id}`, { method: 'DELETE', headers: auth })
      page = body.nextPageToken
    } while (page)
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
}
