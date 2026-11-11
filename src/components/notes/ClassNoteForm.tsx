import { AnimatePresence, motion } from 'framer-motion'
import { Download, FileText, Loader2, Paperclip, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmButton } from '@/components/ui/ConfirmButton'
import { useDashboard } from '@/context/DashboardContext'
import { lastClassDay } from '@/lib/absences'
import { addFile, dataUrlToFile, deleteFile, FileTooBigError, localFile, openFile, sizeLabel } from '@/lib/classFiles'
import { formatDate } from '@/lib/schedule'
import type { NoteFile } from '@/types'
import { Field, PickerPill, TextArea } from '@/components/editor/fields'
import { t } from '@/i18n'

/** A photo's thumbnail, from this device or fetched from Drive. */
function Thumb({ file }: { file: NoteFile }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let live = true
    localFile(file.id)
      .then((d) => d ?? openFile(file))
      .then((d) => live && setSrc(d))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [file])
  return src ? <img src={src} alt="" className="size-full object-cover" /> : <Loader2 aria-hidden className="size-4 animate-spin text-faint" />
}

/**
 * One lecture's note: the day (defaults to the course's latest class), what was covered, and photos or files.
 * Photos open in a viewer here; other files go to the share sheet / a download (open them in Files, Books…).
 */
export function ClassNoteForm({ courseId, id }: { courseId: string; id?: string }) {
  const { classNotes, courses, agenda, notify, calendar, openEditor } = useDashboard()
  const existing = classNotes.items.find((n) => n.id === id)
  const course = courses.items.find((c) => c.id === courseId)
  const [date, setDate] = useState(() => existing?.date ?? (course ? lastClassDay(course, agenda, new Date()) : new Date().toISOString().slice(0, 10)))
  const [text, setText] = useState(existing?.text ?? '')
  const [files, setFiles] = useState<NoteFile[]>(existing?.files ?? [])
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<string>()
  const picker = useRef<HTMLInputElement>(null)
  const signedIn = Boolean(calendar.google.account)
  // Files picked here but not saved yet are removed from this device if the sheet is closed without saving.
  const added = useRef<NoteFile[]>([])

  const pick = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    for (const f of [...list]) {
      try {
        const entry = await addFile(f)
        added.current.push(entry)
        setFiles((l) => [...l, entry])
      } catch (e) {
        notify(e instanceof FileTooBigError ? t('notes.tooBig', { name: f.name }) : t('notes.addFailed', { name: f.name }), 'error')
      }
    }
    setBusy(false)
  }

  const show = async (file: NoteFile) => {
    try {
      const data = await openFile(file)
      if (!data) return notify(file.driveId ? t('notes.downloadFailed') : t('notes.notSynced'), 'error')
      if (file.type.startsWith('image/')) setViewing(data)
      else {
        const f = dataUrlToFile(data, file.name)
        if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: file.name })
        else {
          const url = URL.createObjectURL(f)
          const a = document.createElement('a')
          a.href = url
          a.download = file.name
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 10_000)
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) notify(t('notes.openFailed'), 'error')
    }
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() && !files.length) return notify(t('notes.needContent'), 'error')
    const removed = (existing?.files ?? []).filter((f) => !files.some((x) => x.id === f.id))
    removed.forEach((f) => void deleteFile(f, signedIn))
    const note = { courseId, date, text: text.trim() || undefined, files: files.length ? files : undefined }
    if (existing) classNotes.update(existing.id, note)
    else classNotes.add(note)
    added.current = []
    notify(existing ? t('notes.saved') : t('notes.added'))
    openEditor({ type: 'classNotes', courseId })
  }

  const remove = () => {
    if (!existing) return
    ;(existing.files ?? []).forEach((f) => void deleteFile(f, signedIn))
    classNotes.remove(existing.id)
    notify(t('notes.deleted'))
    openEditor({ type: 'classNotes', courseId })
  }

  // Closing without saving: forget files picked in this visit.
  useEffect(
    () => () => {
      added.current.forEach((f) => void deleteFile(f, false))
    },
    [],
  )

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      {course && <p className="-mt-2 px-1 text-subhead text-muted">{course.name}</p>}
      <div className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-control)] bg-fill/60 px-4 py-1.5">
        <span className="text-body text-ink">{t('notes.class')}</span>
        <PickerPill type="date" label={t('notes.classDay')} value={date} display={formatDate} onChange={(v) => v && setDate(v)} />
      </div>
      <Field label={t('notes.notes')}>
        <TextArea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={t('notes.notesPh')} />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-subhead font-medium text-muted">{t('notes.files')}</span>
        {files.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((f) => (
              <li key={f.id} className="relative">
                <button
                  type="button"
                  onClick={() => show(f)}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[var(--radius-control)] bg-fill p-1 text-center"
                  aria-label={t('notes.open', { name: f.name })}
                >
                  {f.type.startsWith('image/') ? (
                    <Thumb file={f} />
                  ) : (
                    <>
                      <FileText aria-hidden className="size-6 text-muted" />
                      <span className="line-clamp-2 w-full px-1 text-caption break-all text-ink">{f.name}</span>
                      <span className="text-[0.6875rem] text-faint">{sizeLabel(f.size)}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setFiles((l) => l.filter((x) => x.id !== f.id))}
                  aria-label={t('notes.remove', { name: f.name })}
                  className="absolute top-1 end-1 flex size-6 items-center justify-center rounded-full bg-black/55 text-white"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" variant="plain" className="self-start" onClick={() => picker.current?.click()} disabled={busy}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Paperclip aria-hidden className="size-4" strokeWidth={2.2} />}
          {t('notes.add')}
        </Button>
        <input
          ref={picker}
          type="file"
          multiple
          accept="image/*,application/pdf,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.key,.pages,.numbers"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files)
            e.target.value = ''
          }}
        />
        <p className="px-1 text-caption text-faint">
          {signedIn ? t('notes.keptSynced') : t('notes.keptLocal')} {t('notes.limit')}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {existing && <ConfirmButton onConfirm={remove} confirmLabel={t('notes.confirmDelete')}>{t('common.delete')}</ConfirmButton>}
        <Button type="submit" variant="primary" className="ms-auto min-w-28" disabled={busy}>
          {existing ? t('notes.saveBtn') : t('notes.addBtn')}
        </Button>
      </div>

      <AnimatePresence>
        {viewing && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewing(undefined)}
          >
            <img src={viewing} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
            <div className="absolute top-[max(env(safe-area-inset-top),1rem)] end-4 flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const f = dataUrlToFile(viewing, 'photo.jpg')
                  if (navigator.canShare?.({ files: [f] })) void navigator.share({ files: [f] }).catch(() => {})
                }}
                aria-label={t('notes.share')}
                className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
              >
                <Download aria-hidden className="size-5" />
              </button>
              <button type="button" onClick={() => setViewing(undefined)} aria-label={t('common.close')} className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white">
                <X aria-hidden className="size-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  )
}
