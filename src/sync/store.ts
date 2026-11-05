/**
 * The device copy of synced data lives in localStorage under these keys.
 * Writes that come from sync announce themselves so mounted hooks re-read;
 * writes from the user announce a local change so sync pushes them.
 */
import type { SyncDoc, SyncRecord, Tombstones } from './merge'

export const COLLECTION_KEYS = ['dash.courses.v1', 'dash.assignments.v1', 'dash.events.v1', 'dash.tasks.v1', 'dash.study.v1'] as const
export const PROFILE_KEY = 'dash.profile.v1'
export const TOMBSTONES_KEY = 'dash.deleted.v1'
const SYNCED = new Set<string>([...COLLECTION_KEYS, PROFILE_KEY, TOMBSTONES_KEY])

export const REMOTE_EVENT = 'dash:remote-write'
export const LOCAL_EVENT = 'dash:local-change'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked: sync keeps working in memory for this session.
  }
}

export function isSyncedKey(key: string) {
  return SYNCED.has(key)
}

export function announceLocalChange(key: string) {
  if (isSyncedKey(key)) window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: key }))
}

export function readLocalDoc(): SyncDoc {
  const collections: SyncDoc['collections'] = {}
  for (const key of COLLECTION_KEYS) collections[key] = read<SyncRecord[]>(key, [])
  return {
    version: 1,
    collections,
    profile: read<SyncDoc['profile']>(PROFILE_KEY, undefined),
    deleted: read<Tombstones>(TOMBSTONES_KEY, {}),
  }
}

/** Apply a merged document locally and tell mounted hooks which keys changed. */
export function writeLocalDoc(doc: SyncDoc, before: SyncDoc) {
  const changed: string[] = []
  for (const key of COLLECTION_KEYS) {
    if (JSON.stringify(doc.collections[key] ?? []) !== JSON.stringify(before.collections[key] ?? [])) {
      write(key, doc.collections[key] ?? [])
      changed.push(key)
    }
  }
  if (doc.profile && JSON.stringify(doc.profile) !== JSON.stringify(before.profile)) {
    write(PROFILE_KEY, doc.profile)
    changed.push(PROFILE_KEY)
  }
  if (JSON.stringify(doc.deleted) !== JSON.stringify(before.deleted)) write(TOMBSTONES_KEY, doc.deleted)
  if (changed.length) window.dispatchEvent(new CustomEvent(REMOTE_EVENT, { detail: changed }))
}

/**
 * Stamp a collection change: new or edited records get `updatedAt`, list position is kept in `order`,
 * and removed records leave a tombstone so the deletion syncs too.
 */
export function stampChange<T extends SyncRecord>(key: string, prev: T[], next: T[]): T[] {
  const now = Date.now()
  const before = new Map(prev.map((r) => [r.id, r]))
  const strip = ({ updatedAt: _u, ...rest }: T) => JSON.stringify(rest)
  const stamped = next.map((r, i) => {
    const withOrder = { ...r, order: i }
    const old = before.get(r.id)
    return old && strip(old) === strip(withOrder) ? old : { ...withOrder, updatedAt: now }
  })
  const kept = new Set(next.map((r) => r.id))
  const removed = prev.filter((r) => !kept.has(r.id))
  if (removed.length) {
    const tombs = read<Tombstones>(TOMBSTONES_KEY, {})
    tombs[key] ??= {}
    for (const r of removed) tombs[key][r.id] = now
    write(TOMBSTONES_KEY, tombs)
  }
  return stamped
}
