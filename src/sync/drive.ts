/**
 * dash's synced data as one JSON file in the user's Google Drive app-data folder:
 * hidden from Drive's file list and readable only by dash.
 */
import { GoogleReconnectError, invalidateGoogleToken } from '@/data/google'
import type { SyncDoc } from './merge'
import { t } from '@/i18n'

const FILE_NAME = 'unidash-data.json'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export interface RemoteFile {
  id: string
  modifiedTime: string
}

async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
  if (res.status === 401) {
    invalidateGoogleToken()
    throw new GoogleReconnectError(t('google.expired'))
  }
  if (res.status === 403) throw new GoogleReconnectError(t('drive.enable'))
  if (!res.ok) throw new Error(t('drive.status', { status: res.status }))
  return res
}

export async function findFile(token: string): Promise<RemoteFile | null> {
  const q = new URLSearchParams({ spaces: 'appDataFolder', q: `name='${FILE_NAME}' and trashed=false`, fields: 'files(id,modifiedTime)', pageSize: '1' })
  const { files } = (await (await call(token, `${API}/files?${q}`)).json()) as { files?: RemoteFile[] }
  return files?.[0] ?? null
}

export async function fileMeta(token: string, id: string): Promise<RemoteFile | null> {
  try {
    return (await (await call(token, `${API}/files/${id}?fields=id,modifiedTime`)).json()) as RemoteFile
  } catch (e) {
    if (e instanceof GoogleReconnectError) throw e
    return null
  }
}

export async function download(token: string, id: string): Promise<SyncDoc | null> {
  const text = await (await call(token, `${API}/files/${id}?alt=media`)).text()
  try {
    const doc = JSON.parse(text) as SyncDoc
    return doc?.version === 1 ? doc : null
  } catch {
    return null
  }
}

/** Deletes unidash's file from the Drive app-data folder (Delete all data). */
export async function removeFile(token: string, id: string): Promise<void> {
  await call(token, `${API}/files/${id}`, { method: 'DELETE' })
}

export async function upload(token: string, doc: SyncDoc, id?: string): Promise<RemoteFile> {
  const body = JSON.stringify(doc)
  if (id) {
    const res = await call(token, `${UPLOAD}/files/${id}?uploadType=media&fields=id,modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    return (await res.json()) as RemoteFile
  }
  // Multipart as a plain string so it travels unchanged through native HTTP on iOS.
  const boundary = `dash${Date.now()}`
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`
  const res = await call(token, `${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  })
  return (await res.json()) as RemoteFile
}
