import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { locale, t, tn } from '@/i18n'
import { saveFile } from '@/lib/saveFile'
import { backupName, backupText, BackupFormatError, describe, itemCount, parseBackup, readSnapshots, restore, type Snapshot } from '@/sync/backup'
import type { SyncDoc } from '@/sync/merge'
import { readLocalDoc } from '@/sync/store'

const when = (iso: string) => new Date(iso).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const reasonKey = { daily: 'bk.daily', 'before-delete': 'bk.beforeDelete', 'before-restore': 'bk.beforeRestore' } as const

/**
 * Settings → Data: export everything to a file (or the clipboard), restore from a file, copied text or one of the copies
 * this device keeps (one a day, the last 7). Restoring only adds what's missing; nothing is deleted or overwritten.
 */
export function BackupSection() {
  const { notify } = useDashboard()
  const fileInput = useRef<HTMLInputElement>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>(readSnapshots)
  const here = readLocalDoc()

  const exportBackup = async () => {
    const name = backupName()
    const how = await saveFile(name, backupText(), 'application/json').catch(() => 'failed' as const)
    if (how === 'copied') notify(t('bk.copied'))
    else if (how === 'downloaded') notify(t('bk.saved', { name }))
    else if (how === 'failed') notify(t('bk.saveFailed'), 'error')
  }

  const restoreDoc = (doc: SyncDoc) => {
    const ids = new Map(Object.entries(here.collections).map(([k, list]) => [k, new Set(list.map((r) => r.id))]))
    const missing = Object.entries(doc.collections).reduce((n, [k, list]) => n + list.filter((r) => !ids.get(k)?.has(r.id)).length, 0)
    if (!missing) return notify(t('bk.nothing'))
    const added = restore(doc)
    setSnapshots(readSnapshots())
    notify(tn('bk.restored', added))
  }

  const restoreText = (text: string) => {
    try {
      restoreDoc(parseBackup(text).doc)
    } catch (e) {
      notify(e instanceof BackupFormatError ? e.message : t('bk.readFailed'), 'error')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-subhead text-muted">{t('bk.here', { items: describe(here) })}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={exportBackup} disabled={itemCount(here) === 0}>
          {t('bk.export')}
        </Button>
        <Button size="sm" onClick={() => fileInput.current?.click()}>
          {t('bk.restoreFile')}
        </Button>
        <Button
          size="sm"
          variant="plain"
          onClick={async () => {
            try {
              restoreText(await navigator.clipboard.readText())
            } catch {
              notify(t('bk.clipboardFailed'), 'error')
            }
          }}
        >
          {t('bk.restorePaste')}
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json,text/plain"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) restoreText(await f.text())
        }}
      />
      {snapshots.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-subhead font-medium text-muted">{t('bk.copies')}</span>
          <ul className="surface separated">
            {snapshots.map((s) => (
              <li key={s.createdAt} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-body text-ink">
                    {when(s.createdAt)} · {t(reasonKey[s.reason])}
                  </span>
                  <span className="block truncate text-subhead text-muted">{describe(s.doc)}</span>
                </span>
                <Button size="sm" onClick={() => restoreDoc(s.doc)}>
                  {t('bk.restore')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="px-1 text-caption text-faint">{t('bk.footer')}</p>
    </div>
  )
}
