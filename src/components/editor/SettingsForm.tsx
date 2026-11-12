import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { useDashboard } from '@/context/DashboardContext'
import { searchPlace } from '@/data/weather'
import { dayLabel, lookUp, minuteOptions, minutesLabel, modes, passDays } from '@/lib/setup'
import { since } from '@/lib/date'
import { parseIcs } from '@/lib/ics'
import { parseTimes } from '@/lib/commute'
import { deleteEverything, feedbackDetails } from '@/lib/wipe'
import { FEEDBACK_EMAIL, FEEDBACK_REPO } from '@/config'
import { BUILD, BUILT_AT } from '@/lib/liveUpdate'
import { isMacApp } from '@/lib/macApp'
import { isNative } from '@/lib/native'
import type { Place, LookPreference, ThemePreference } from '@/types'
import { SchoolPicker } from '@/components/place/SchoolPicker'
import { ConfirmButton } from '@/components/ui/ConfirmButton'
import { takeSnapshot } from '@/sync/backup'
import { BackupSection } from './BackupSection'
import { Field, FormGroup, Select, TextArea, TextInput, Toggle } from './fields'
import { lang, langIsChosen, languages, locale, setLanguage, t, tn, type LangCode } from '@/i18n'

const isCalendarUrl = (u: string) => /^(https?|webcal):\/\/\S+/i.test(u.trim())

const looks: Array<{ value: LookPreference; label: string }> = [
  { value: 'classic', label: t('set.designClassic') },
  { value: 'obsidian', label: t('set.designObsidian') },
]

const themes: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: t('set.auto') },
  { value: 'light', label: t('set.light') },
  { value: 'dark', label: t('set.dark') },
]

export function SettingsForm({ onDone, section }: { onDone: () => void; section?: 'calendar' | 'commute' }) {
  const { profile, setProfile, events, courses, tasks, calendar, cloud, reminders, location, loadSample, theme, notify } = useDashboard()
  const [feedback, setFeedback] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [calendarText, setCalendarText] = useState((profile.calendarUrls ?? []).join('\n'))
  const [name, setName] = useState(profile.name)
  const [city, setCity] = useState(profile.place?.name ?? '')
  const [schoolName, setSchoolName] = useState(profile.school?.name ?? '')
  const [address, setAddress] = useState(profile.school?.address ?? '')
  // The school's position: from the saved profile, a search pick or a dragged pin.
  const [schoolPlace, setSchoolPlace] = useState<Place | undefined>(profile.school?.place)
  const [home, setHome] = useState(profile.home?.name ?? '')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const calendarSection = useRef<HTMLDivElement>(null)
  const commuteSection = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = section === 'calendar' ? calendarSection : section === 'commute' ? commuteSection : null
    target?.current?.scrollIntoView({ block: 'start' })
  }, [section])

  const connect = (text: string) => {
    const urls = text.split(/\s+/).filter(isCalendarUrl)
    setProfile({ calendarUrls: urls })
    setCalendarText(urls.join('\n'))
    notify(urls.length ? t('set.calConnected') : t('set.calDisconnected'))
  }

  const pasteAndConnect = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (!isCalendarUrl(text)) {
        notify(t('set.clipboardNoLink'), 'error')
        return
      }
      connect([calendarText, text].filter(Boolean).join('\n'))
    } catch {
      notify(t('set.clipboardFailed'), 'error')
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const trimmed = city.trim()
      let place = profile.place
      if (!trimmed) place = undefined
      else if (trimmed !== profile.place?.name) {
        const found = await searchPlace(trimmed)
        if (!found) {
          notify(t('set.noPlace', { name: trimmed }), 'error')
          return
        }
        place = found
      }
      const found = schoolPlace && address.trim() ? { place: schoolPlace, found: true } : await lookUp(address, { text: profile.school?.address, place: profile.school?.place })
      const homePlace = home.trim() === profile.home?.name ? { place: profile.home, found: true } : await lookUp(home)
      const school = schoolName.trim() || address.trim() ? { name: schoolName.trim() || undefined, address: address.trim() || undefined, place: found.place } : undefined
      setProfile({ name: name.trim(), place, school, home: homePlace.place })
      if (!homePlace.found) notify(t('set.homeNotFound', { name: home.trim() }), 'error')
      else if (!found.found) notify(t('set.schoolNotFound'))
      else notify(t('set.saved'))
      if (homePlace.found) onDone()
    } catch {
      notify(t('set.locServiceFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const importIcs = async (file: File) => {
    const imported = parseIcs(await file.text())
    if (imported.length === 0) {
      notify(t('set.noEvents'), 'error')
      return
    }
    const ids = new Set(imported.map((e) => e.id))
    events.set((list) => [...list.filter((e) => !ids.has(e.id)), ...imported])
    notify(tn('set.imported', imported.length))
  }

  return (
    <div className="flex flex-col gap-8">
      <FormGroup title={t('set.appearance')}>
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-subhead font-medium text-muted">{t('set.design')}</span>
          <Segmented label={t('set.design')} options={looks} value={theme.look.preference} onChange={theme.look.setPreference} block />
          {/* The note belongs to the Design choice, not to the language below. */}
          <p className="px-1 text-caption text-muted">{t('set.designHint')}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-subhead font-medium text-muted">{t('set.theme')}</span>
          <Segmented label={t('set.theme')} options={themes} value={theme.preference} onChange={theme.setPreference} block />
        </div>
        <Field label={t('set.language')}>
          <Select value={langIsChosen() ? lang : ''} onChange={(e) => setLanguage((e.target.value || undefined) as LangCode | undefined)}>
            <option value="">{t('set.languageAuto', { name: languages.find((l) => l.code === lang)?.name ?? lang })}</option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
      </FormGroup>

      {/* Quick add from anywhere: an iPhone Shortcut opens unidash://add?text=… (lib/addLink.ts). */}
      {isNative && (
        <FormGroup title={t('set.share')}>
          <p className="px-1 text-subhead text-muted">{t('set.shareHint')}</p>
          <ol className="list-decimal space-y-1 ps-6 text-subhead text-muted">
            <li>{t('set.share1')}</li>
            <li>{t('set.share2')}</li>
            <li>{t('set.share3')}</li>
          </ol>
        </FormGroup>
      )}

      <form onSubmit={save}>
        <FormGroup title={t('set.you')}>
          <Field label={t('set.name')} hint={t('set.nameHint')}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-subhead font-medium text-muted">{t('place.search')}</span>
            <SchoolPicker
              place={schoolPlace}
              near={schoolPlace ?? profile.home ?? profile.place}
              onPick={(hit) => {
                if (hit.name) setSchoolName(hit.name)
                setAddress(hit.address)
                setSchoolPlace({ name: hit.area, latitude: hit.latitude, longitude: hit.longitude })
              }}
              onMove={(latitude, longitude, hit) => {
                setSchoolPlace((p) => ({ name: hit?.area || p?.name || '', latitude, longitude }))
                if (hit) {
                  setAddress(hit.address)
                  if (hit.name && !schoolName.trim()) setSchoolName(hit.name)
                }
              }}
            />
          </div>
          <Field label={t('set.school')} hint={t('set.schoolHint')}>
            <TextInput value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder={t('set.schoolPh')} autoComplete="organization" />
          </Field>
          <Field label={t('set.address')} hint={t('set.addressHint')}>
            <TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('set.addressPh')} autoComplete="off" />
          </Field>
          <Field label={t('set.home')} hint={t('set.homeHint')}>
            <TextInput value={home} onChange={(e) => setHome(e.target.value)} placeholder={t('set.homePh')} autoComplete="off" />
          </Field>
          <Toggle
            label={t('set.useLocation')}
            checked={profile.autoLocation === true}
            onChange={(v) => setProfile({ autoLocation: v })}
          />
          {profile.autoLocation === true && (
            <p className="-mt-1 px-1 text-subhead text-muted">
              {location.denied
                ? t('set.locDenied')
                : location.here
                  ? t('set.locHere', { place: location.here.name })
                  : t('set.locFinding')}
            </p>
          )}
          <Field label={t('set.city')} hint={t('set.cityHint')}>
            <TextInput value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('set.cityPh')} autoComplete="address-level2" />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button type="submit" variant="primary" disabled={busy} className="min-w-24">
              {busy ? t('set.saving') : t('common.save')}
            </Button>
          </div>
        </FormGroup>
      </form>

      <div ref={commuteSection} className="scroll-mt-4">
        <FormGroup
          title={t('set.commute')}
          footer={t('set.commuteFooter')}
        >
          <Segmented
            label={t('set.how')}
            options={modes}
            value={profile.commute?.mode ?? 'transit'}
            onChange={(mode) => setProfile({ commute: { ...profile.commute, mode } })}
            block
          />
          <Field label={t('set.doorToDoor')}>
            <Select
              value={profile.commute?.minutes ?? ''}
              onChange={(e) => {
                setProfile({ commute: { ...profile.commute, minutes: e.target.value ? +e.target.value : undefined } })
                notify(t('set.travelSaved'))
              }}
            >
              <option value="">{t('common.notSet')}</option>
              {minuteOptions.map((m) => (
                <option key={m} value={m}>
                  {minutesLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
          {(profile.commute?.mode ?? 'transit') === 'transit' && (
            <>
              <Field
                label={t('set.departures')}
                hint={t('set.departuresHint')}
              >
                <TextInput
                  defaultValue={(profile.commute?.departures ?? []).join(', ')}
                  inputMode="numeric"
                  placeholder="08:05, 08:35, 09:05"
                  onBlur={(e) => {
                    const times = parseTimes(e.target.value)
                    e.target.value = times.join(', ')
                    if (times.join() !== (profile.commute?.departures ?? []).join()) {
                      setProfile({ commute: { ...profile.commute, departures: times.length ? times : undefined } })
                      notify(times.length ? t('set.departuresSaved') : t('set.departuresRemoved'))
                    }
                  }}
                />
              </Field>
              {Boolean(profile.commute?.departures?.length) && (
                <Field label={t('set.toStop')}>
                  <Select
                    value={profile.commute?.toStop ?? 0}
                    onChange={(e) => setProfile({ commute: { ...profile.commute, toStop: +e.target.value } })}
                  >
                    {[0, 2, 5, 8, 10, 12, 15, 20, 25, 30, 40, 45, 60].map((m) => (
                      <option key={m} value={m}>
                        {m ? minutesLabel(m) : t('set.rightOutside')}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </>
          )}
          <Toggle
            label={t('set.pass')}
            checked={Boolean(profile.pass?.renewDay)}
            onChange={(v) => setProfile({ pass: v ? { renewDay: profile.pass?.renewDay ?? 1 } : undefined })}
          />
          {profile.pass?.renewDay && (
            <Field label={t('set.passDay')} hint={t('set.passHint')}>
              <Select value={profile.pass.renewDay} onChange={(e) => setProfile({ pass: { renewDay: +e.target.value } })}>
                {passDays.map((d) => (
                  <option key={d} value={d}>
                    {dayLabel(d)} of each month
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </FormGroup>
      </div>

      {reminders.permission !== 'unavailable' && (
      <FormGroup
        title={t('set.reminders')}
        footer={
          reminders.permission === 'granted'
            ? `${tn('set.lined', reminders.scheduled)} ${isMacApp ? t('set.arriveMac') : t('set.arrive')}`
            : undefined
        }
      >
        {reminders.permission === 'granted' && (
          <div className="flex flex-col gap-1">
            <Toggle
              label={t('set.remLeave')}
              checked={profile.reminders?.leave !== false}
              onChange={(v) => setProfile({ reminders: { ...profile.reminders, leave: v } })}
            />
            <Toggle
              label={t('set.remDeadlines')}
              checked={profile.reminders?.deadlines !== false}
              onChange={(v) => setProfile({ reminders: { ...profile.reminders, deadlines: v } })}
            />
            {profile.pass?.renewDay && (
              <Toggle
                label={t('set.remPass')}
                checked={profile.reminders?.pass !== false}
                onChange={(v) => setProfile({ reminders: { ...profile.reminders, pass: v } })}
              />
            )}
          </div>
        )}
        {reminders.permission === 'prompt' && (
          <Button size="sm" variant="primary" className="self-start" onClick={reminders.enable}>
            {t('rem.turnOn')}
          </Button>
        )}
        {(reminders.permission === 'granted' || reminders.permission === 'prompt') && (
          <Button
            size="sm"
            className="self-start"
            onClick={async () => {
              await reminders.test()
              notify(t('set.testSent'))
            }}
          >
            {t('set.sendTest')}
          </Button>
        )}
        {reminders.permission === 'denied' && (
          <p className="px-1 text-subhead text-muted">{t('set.notifOff')}</p>
        )}
        <p className="px-1 text-subhead text-muted">
          {profile.pass?.renewDay ? t('set.remWhenPass') : t('set.remWhen')}
        </p>
      </FormGroup>
      )}

      <div ref={calendarSection} className="scroll-mt-4">
        <FormGroup
          title={t('set.google')}
          footer={t('set.googleFooter')}
        >
          {calendar.google.account ? (
            <div className="surface flex items-center gap-3 px-4 py-3">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-headline text-accent">
                {(calendar.google.account.name ?? calendar.google.account.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-ink">{calendar.google.account.name ?? t('set.googleAccount')}</span>
                <span className="block truncate text-subhead text-muted">{calendar.google.account.email}</span>
              </span>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  await calendar.google.disconnect()
                  notify(t('set.googleDisconnected'))
                }}
              >
                {t('set.disconnect')}
              </Button>
            </div>
          ) : calendar.google.available ? (
            <Button
              variant="primary"
              className="w-full"
              disabled={calendar.google.connecting}
              onClick={async () => {
                try {
                  await calendar.google.connect()
                  notify(t('google.connected'))
                } catch (e) {
                  notify(e instanceof Error && /cancel|closed/i.test(e.message) ? t('google.cancelled') : t('google.connectFailed'), 'error')
                }
              }}
            >
              {calendar.google.connecting ? t('google.waiting') : t('set.connectGoogle')}
            </Button>
          ) : (
            <p className="px-1 text-subhead text-muted">{t('set.googleOff')}</p>
          )}
          {calendar.google.account && (
            <div className="surface flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-body font-medium text-ink">{t('set.syncDevices')}</span>
                <span className={`block text-subhead ${cloud.status === 'error' || cloud.status === 'paused' ? 'text-danger' : 'text-muted'}`}>
                  {cloud.status === 'syncing'
                    ? 'Syncing…'
                    : cloud.status === 'paused' || cloud.status === 'error'
                      ? cloud.error
                      : cloud.lastSyncedAt
                        ? t('set.upToDate', { when: since(new Date(cloud.lastSyncedAt)) })
                        : t('set.firstSync')}
                </span>
              </span>
              {cloud.status === 'paused' ? (
                <Button size="sm" variant="primary" onClick={() => calendar.google.connect().then(cloud.syncNow).catch(() => {})}>
                  {t('set.reconnect')}
                </Button>
              ) : (
                <Button size="sm" onClick={cloud.syncNow} disabled={cloud.status === 'syncing'}>
                  {t('set.syncNow')}
                </Button>
              )}
            </div>
          )}
          {calendar.status === 'reconnect' && calendar.google.account && (
            <Button size="sm" variant="primary" onClick={() => calendar.google.connect().catch(() => {})} className="self-start">
              {t('set.reconnect')}
            </Button>
          )}
          {calendar.status !== 'off' && (
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="min-w-0 text-subhead text-muted">
                {calendar.status === 'syncing'
                  ? 'Syncing…'
                  : calendar.syncedAt
                    ? tn('set.upcoming', calendar.events.length, { when: since(new Date(calendar.syncedAt)) })
                    : t('set.notSynced')}
              </p>
              <Button size="sm" onClick={calendar.sync} disabled={calendar.status === 'syncing'}>
                {t('set.syncNow')}
              </Button>
            </div>
          )}
          {calendar.status === 'error' && <p className="px-1 text-subhead text-danger">{calendar.error}</p>}

          {isNative && (
          <details className="group">
            <summary className="cursor-pointer list-none px-1 text-subhead font-medium text-accent [&::-webkit-details-marker]:hidden">
              {t('set.ical')}
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <ol className="list-decimal space-y-1 ps-6 text-subhead text-muted">
                <li>{t('set.ical1')}</li>
                <li>{t('set.ical2')}</li>
                <li>{t('set.ical3')}</li>
              </ol>
              <Button onClick={pasteAndConnect} className="w-full">
                {t('set.paste')}
              </Button>
              <TextArea
                value={calendarText}
                onChange={(e) => setCalendarText(e.target.value)}
                rows={3}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                aria-label={t('set.calAddresses')}
                className="break-all"
              />
              <Button size="sm" onClick={() => connect(calendarText)} className="self-start">
                {profile.calendarUrls?.length ? t('set.saveAddresses') : t('set.connectTyped')}
              </Button>
            </div>
          </details>
          )}
        </FormGroup>
      </div>

      <FormGroup title={t('set.import')} footer={t('set.importFooter')}>
        <p className="px-1 text-subhead text-muted">{t('set.importText')}</p>
        <input
          ref={fileInput}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importIcs(f)
            e.target.value = ''
          }}
        />
        <Button size="sm" onClick={() => fileInput.current?.click()} className="self-start">
          {t('set.chooseFile')}
        </Button>
      </FormGroup>

      <FormGroup title={t('set.data')} footer={calendar.google.account ? t('set.dataDrive') : t('set.dataLocal')}>
        <BackupSection />
        <div className="flex flex-wrap gap-2">
          {/* Sample data only while there's nothing yet: loading it replaces what's there (and syncs). */}
          {courses.items.length === 0 && tasks.tasks.length === 0 && (
            <Button
              size="sm"
              onClick={() => {
                takeSnapshot('before-delete')
                loadSample()
                notify(t('set.sampleLoaded'))
                onDone()
              }}
            >
              {t('set.loadSample')}
            </Button>
          )}
          <ConfirmButton
            size="sm"
            confirmLabel={calendar.google.account ? t('del.againDrive') : t('del.again')}
            onConfirm={() => {
              const signedIn = Boolean(calendar.google.account)
              setDeleting(true)
              deleteEverything(signedIn ? calendar.google : undefined).catch(() => {
                setDeleting(false)
                notify(t('del.failed'), 'error')
              })
            }}
          >
            {deleting ? t('del.deleting') : t('set.deleteAll')}
          </ConfirmButton>
        </div>
        <p className="px-1 text-caption text-faint">{calendar.google.account ? t('del.hintDrive') : t('del.hint')}</p>
      </FormGroup>

      <FormGroup title={t('fb.title')} footer={t('fb.footer')}>
        <p className="px-1 text-subhead text-muted">{t('fb.lead')}</p>
        <TextArea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} placeholder={t('fb.placeholder')} aria-label={t('fb.title')} />
        <Button
          size="sm"
          variant="primary"
          className="self-start"
          disabled={!feedback.trim()}
          onClick={() => {
            const body = `${feedback.trim()}\n\n---\n${feedbackDetails(BUILD, lang)}`
            const url = FEEDBACK_EMAIL
              ? `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(t('fb.subject'))}&body=${encodeURIComponent(body)}`
              : `https://github.com/${FEEDBACK_REPO}/issues/new?title=${encodeURIComponent(t('fb.subject'))}&body=${encodeURIComponent(body)}`
            window.open(url, '_blank', 'noopener')
            setFeedback('')
            notify(t('fb.thanks'))
          }}
        >
          {FEEDBACK_EMAIL ? t('fb.sendEmail') : t('fb.sendGithub')}
        </Button>
      </FormGroup>

      <FormGroup
        title={t('set.about')}
        footer={isNative ? t('set.liveUpdate') : undefined}
      >
        <p className="px-1 text-subhead text-muted">
          {t('set.version')} <span className="font-medium text-ink tabular-nums">{BUILD}</span> · {t('set.built')}{' '}
          {BUILT_AT.toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        <Button
          size="sm"
          className="self-start"
          onClick={() => {
            setProfile({ onboarded: false })
            onDone()
          }}
        >
          {t('set.rerun')}
        </Button>
        <a href="./privacy.html" target="_blank" rel="noreferrer" className="self-start px-1 text-subhead font-medium text-accent">
          {t('set.privacy')}
        </a>
      </FormGroup>
    </div>
  )
}
