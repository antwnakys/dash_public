/**
 * Backups of everything unidash syncs (courses, deadlines, events, tasks, study plans, exam results, settings).
 * Device-only data (Google sign-in, the calendar copy) is never included.
 *
 * - Export: a JSON file (or the clipboard) the user keeps somewhere safe.
 * - Snapshots: a copy kept on this device once a day (last 7) and before anything that removes a lot at once.
 * - Restore (from a file or a snapshot) only ever adds: items missing on this device come back, items that are
 *   here stay as they are. Nothing is deleted or overwritten with older versions.
 */
import type { SyncDoc, SyncRecord } from './merge'
import { tn, t } from '@/i18n'
import { announceLocalChange, COLLECTION_KEYS, PROFILE_KEY, readLocalDoc, writeLocalDoc } from './store'

const SNAPSHOTS_KEY = 'unidash.snapshots.v1'
const KEEP = 7
const DAY = 86_400_000

export interface BackupFile {
  app: 'unidash'
  kind: 'backup'
  /** ISO timestamp */
  createdAt: string
  doc: SyncDoc
}

export interface Snapshot {
  /** ISO timestamp */
  createdAt: string
  reason: 'daily' | 'before-delete' | 'before-restore'
  doc: SyncDoc
}

/** "23 items", in the page's language. */
export function describe(doc: SyncDoc): string {
  return tn('bk.items', itemCount(doc))
}

export const itemCount = (doc: SyncDoc) => COLLECTION_KEYS.reduce((n, key) => n + (doc.collections[key]?.length ?? 0), 0)

export function backupText(doc: SyncDoc = readLocalDoc()): string {
  const file: BackupFile = { app: 'unidash', kind: 'backup', createdAt: new Date().toISOString(), doc }
  return JSON.stringify(file, null, 1)
}

export const backupName = (d = new Date()) =>
  `unidash-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`

export class BackupFormatError extends Error {}

/** Reads a backup file (or the bare synced document); throws BackupFormatError for anything else. */
export function parseBackup(text: string): { doc: SyncDoc; createdAt?: string } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupFormatError(t('bk.notBackup'))
  }
  const file = data as Partial<BackupFile> & Partial<SyncDoc>
  const doc = (file.kind === 'backup' ? file.doc : file) as Partial<SyncDoc> | undefined
  if (!doc || doc.version !== 1 || typeof doc.collections !== 'object' || doc.collections === null)
    throw new BackupFormatError(t('bk.notBackup'))
  const collections: SyncDoc['collections'] = {}
  for (const key of COLLECTION_KEYS) {
    const list = doc.collections[key]
    collections[key] = Array.isArray(list) ? list.filter((r): r is SyncRecord => !!r && typeof (r as SyncRecord).id === 'string') : []
  }
  return { doc: { version: 1, collections, profile: doc.profile, deleted: {} }, createdAt: file.createdAt }
}

/**
 * Adds what the backup has and this device doesn't. Restored items get a fresh change time, so they win over
 * any deletion and reach the other devices through sync. Settings are only taken when this device has none.
 */
export function restoreInto(local: SyncDoc, backup: SyncDoc, now = Date.now()): { doc: SyncDoc; added: number } {
  let added = 0
  const collections: SyncDoc['collections'] = {}
  const deleted: SyncDoc['deleted'] = JSON.parse(JSON.stringify(local.deleted ?? {}))
  for (const key of COLLECTION_KEYS) {
    const here = local.collections[key] ?? []
    const ids = new Set(here.map((r) => r.id))
    const missing = (backup.collections[key] ?? []).filter((r) => !ids.has(r.id)).map((r) => ({ ...r, updatedAt: now }))
    added += missing.length
    collections[key] = [...here, ...missing]
    for (const r of missing) if (deleted[key]) delete deleted[key][r.id]
  }
  const hasProfile = local.profile && Object.keys(local.profile).some((k) => k !== 'updatedAt')
  const profile = hasProfile ? local.profile : backup.profile ? { ...backup.profile, updatedAt: now } : local.profile
  return { doc: { version: 1, collections, profile, deleted }, added }
}

/** Restore a backup on this device and let sync carry it to the others. Returns how many items came back. */
export function restore(backup: SyncDoc): number {
  const local = readLocalDoc()
  takeSnapshot('before-restore', local)
  const { doc, added } = restoreInto(local, backup)
  writeLocalDoc(doc, local)
  for (const key of [...COLLECTION_KEYS, PROFILE_KEY]) announceLocalChange(key)
  return added
}

export function readSnapshots(): Snapshot[] {
  try {
    const list = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) ?? '[]') as Snapshot[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveSnapshots(list: Snapshot[]) {
  // Newest first; if storage is full, drop the oldest until it fits.
  for (let keep = Math.min(list.length, KEEP); keep > 0; keep--) {
    try {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list.slice(0, keep)))
      return
    } catch {
      // Try again with one fewer.
    }
  }
}

export function takeSnapshot(reason: Snapshot['reason'], doc: SyncDoc = readLocalDoc()) {
  if (itemCount(doc) === 0) return
  saveSnapshots([{ createdAt: new Date().toISOString(), reason, doc }, ...readSnapshots()])
}

/** Once a day, when dash opens: keeps a week of copies on this device. */
export function dailySnapshot(now = Date.now()) {
  const last = readSnapshots().find((s) => s.reason === 'daily')
  if (last && now - new Date(last.createdAt).getTime() < DAY) return
  takeSnapshot('daily')
}
