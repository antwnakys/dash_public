/**
 * Conflict-free merge for dash's synced data.
 * Every record carries `updatedAt`; deletions leave tombstones. The newest write wins per record,
 * and a tombstone beats any version of the record that is older than the deletion.
 */

export interface SyncRecord {
  id: string
  updatedAt?: number
  order?: number
}

export type Tombstones = Record<string, Record<string, number>>

export interface SyncDoc {
  version: 1
  collections: Record<string, SyncRecord[]>
  profile?: Record<string, unknown> & { updatedAt?: number }
  deleted: Tombstones
}

const TOMBSTONE_TTL = 90 * 86_400_000

const byOrder = (a: SyncRecord, b: SyncRecord) => (a.order ?? Infinity) - (b.order ?? Infinity)

function mergeTombstones(a: Tombstones, b: Tombstones, now: number): Tombstones {
  const out: Tombstones = {}
  for (const src of [a, b]) {
    for (const [key, ids] of Object.entries(src ?? {})) {
      for (const [id, ts] of Object.entries(ids)) {
        if (now - ts > TOMBSTONE_TTL) continue
        out[key] ??= {}
        out[key][id] = Math.max(out[key][id] ?? 0, ts)
      }
    }
  }
  return out
}

function mergeRecords(a: SyncRecord[] = [], b: SyncRecord[] = [], dead: Record<string, number> = {}): SyncRecord[] {
  const merged = new Map<string, SyncRecord>()
  for (const r of [...a, ...b]) {
    const prev = merged.get(r.id)
    if (!prev || (r.updatedAt ?? 0) > (prev.updatedAt ?? 0)) merged.set(r.id, r)
  }
  return [...merged.values()].filter((r) => (dead[r.id] ?? -1) < (r.updatedAt ?? 0)).sort(byOrder)
}

export function mergeDocs(local: SyncDoc, remote: SyncDoc, now = Date.now()): SyncDoc {
  const deleted = mergeTombstones(local.deleted, remote.deleted, now)
  const keys = new Set([...Object.keys(local.collections), ...Object.keys(remote.collections)])
  const collections: SyncDoc['collections'] = {}
  for (const key of keys) collections[key] = mergeRecords(local.collections[key], remote.collections[key], deleted[key])
  const profile =
    (remote.profile?.updatedAt ?? 0) > (local.profile?.updatedAt ?? 0) ? remote.profile : (local.profile ?? remote.profile)
  return { version: 1, collections, profile, deleted }
}

/** Stable comparison, so unchanged data is never re-uploaded or re-applied. */
export const sameDoc = (a: SyncDoc, b: SyncDoc) => JSON.stringify(a) === JSON.stringify(b)
