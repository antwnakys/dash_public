import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { useDashboard } from '@/context/DashboardContext'
import { searchPlace } from '@/data/weather'
import { dayLabel, lookUp, minuteOptions, minutesLabel, modes, passDays } from '@/lib/setup'
import { countdown } from '@/lib/date'
import { parseIcs } from '@/lib/ics'
import { parseTimes } from '@/lib/commute'
import { BUILD, BUILT_AT } from '@/lib/liveUpdate'
import { isMacApp } from '@/lib/macApp'
import { isNative } from '@/lib/native'
import type { ThemePreference } from '@/types'
import { Field, FormGroup, Select, TextArea, TextInput, Toggle } from './fields'

const isCalendarUrl = (u: string) => /^(https?|webcal):\/\/\S+/i.test(u.trim())

const themes: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'Automatic' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function SettingsForm({ onDone, section }: { onDone: () => void; section?: 'calendar' | 'commute' }) {
  const { profile, setProfile, events, courses, calendar, cloud, reminders, location, loadSample, clearAll, theme, notify } = useDashboard()
  const [calendarText, setCalendarText] = useState((profile.calendarUrls ?? []).join('\n'))
  const [name, setName] = useState(profile.name)
  const [city, setCity] = useState(profile.place?.name ?? '')
  const [schoolName, setSchoolName] = useState(profile.school?.name ?? '')
  const [address, setAddress] = useState(profile.school?.address ?? '')
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
    notify(urls.length ? 'Calendar connected' : 'Calendar disconnected')
  }

  const pasteAndConnect = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (!isCalendarUrl(text)) {
        notify('The clipboard doesn’t hold a calendar link. Copy the secret iCal address first.', 'error')
        return
      }
      connect([calendarText, text].filter(Boolean).join('\n'))
    } catch {
      notify('Couldn’t read the clipboard. Paste into the box below instead.', 'error')
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
          notify(`No place called “${trimmed}” was found. Check the spelling.`, 'error')
          return
        }
        place = found
      }
      const schoolPlace = await lookUp(address, { text: profile.school?.address, place: profile.school?.place })
      const homePlace = home.trim() === profile.home?.name ? { place: profile.home, found: true } : await lookUp(home)
      const school = schoolName.trim() || address.trim() ? { name: schoolName.trim() || undefined, address: address.trim() || undefined, place: schoolPlace.place } : undefined
      setProfile({ name: name.trim(), place, school, home: homePlace.place })
      if (!homePlace.found) notify(`Couldn’t find “${home.trim()}” on the map. Try a neighbourhood and city.`, 'error')
      else if (!schoolPlace.found) notify('Saved. The school address wasn’t found on the map, so there’s no weather for it, but classes there still count.')
      else notify('Settings saved')
      if (homePlace.found) onDone()
    } catch {
      notify('Couldn’t reach the location service. Check your connection.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const importIcs = async (file: File) => {
    const imported = parseIcs(await file.text())
    if (imported.length === 0) {
      notify('No upcoming events were found in that file.', 'error')
      return
    }
    const ids = new Set(imported.map((e) => e.id))
    events.set((list) => [...list.filter((e) => !ids.has(e.id)), ...imported])
    notify(`Imported ${imported.length} ${imported.length === 1 ? 'event' : 'events'}`)
  }

  return (
    <div className="flex flex-col gap-8">
      <FormGroup title="Appearance">
        <Segmented label="Theme" options={themes} value={theme.preference} onChange={theme.setPreference} block />
      </FormGroup>

      <form onSubmit={save}>
        <FormGroup title="You">
          <Field label="Name" hint="Used in the greeting.">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label="School" hint="Optional, e.g. University of Piraeus.">
            <TextInput value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="School name" autoComplete="organization" />
          </Field>
          <Field label="School address" hint="Street and number. Events in your calendar at this address count as classes.">
            <TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street 12, Area" autoComplete="off" />
          </Field>
          <Field label="Where you live" hint="A neighbourhood is enough. Used for the weather on your way and when location is off.">
            <TextInput value={home} onChange={(e) => setHome(e.target.value)} placeholder="Neighbourhood, City" autoComplete="off" />
          </Field>
          <Toggle
            label="Use this device’s location for the weather"
            checked={profile.autoLocation === true}
            onChange={(v) => setProfile({ autoLocation: v })}
          />
          {profile.autoLocation === true && (
            <p className="-mt-1 px-1 text-subhead text-muted">
              {location.denied
                ? 'Location is off for unidash in this browser, so the weather uses where you live.'
                : location.here
                  ? `Weather for where you are: ${location.here.name}. This device only.`
                  : 'Finding where you are…'}
            </p>
          )}
          <Field label="Weather city (optional)" hint="Leave empty to use where you live.">
            <TextInput value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" autoComplete="address-level2" />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button type="submit" variant="primary" disabled={busy} className="min-w-24">
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </FormGroup>
      </form>

      <div ref={commuteSection} className="scroll-mt-4">
        <FormGroup
          title="Getting to school"
          footer="Today shows when to leave for your first class at school; in the evening, for tomorrow’s. Online lessons don’t count."
        >
          <Segmented
            label="How you get there"
            options={modes}
            value={profile.commute?.mode ?? 'transit'}
            onChange={(mode) => setProfile({ commute: { ...profile.commute, mode } })}
            block
          />
          <Field label="Door to door">
            <Select
              value={profile.commute?.minutes ?? ''}
              onChange={(e) => {
                setProfile({ commute: { ...profile.commute, minutes: e.target.value ? +e.target.value : undefined } })
                notify('Travel time saved')
              }}
            >
              <option value="">Not set</option>
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
                label="Bus or train times (optional)"
                hint="If you always catch one of a few departures, list them. unidash picks the latest one that gets you there on time."
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
                      notify(times.length ? 'Departure times saved' : 'Departure times removed')
                    }
                  }}
                />
              </Field>
              {Boolean(profile.commute?.departures?.length) && (
                <Field label="From home to that stop">
                  <Select
                    value={profile.commute?.toStop ?? 0}
                    onChange={(e) => setProfile({ commute: { ...profile.commute, toStop: +e.target.value } })}
                  >
                    {[0, 2, 5, 8, 10, 12, 15, 20, 25, 30, 40, 45, 60].map((m) => (
                      <option key={m} value={m}>
                        {m ? minutesLabel(m) : 'Right outside'}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </>
          )}
          <Toggle
            label="Monthly travel pass"
            checked={Boolean(profile.pass?.renewDay)}
            onChange={(v) => setProfile({ pass: v ? { renewDay: profile.pass?.renewDay ?? 1 } : undefined })}
          />
          {profile.pass?.renewDay && (
            <Field label="It runs out on" hint="Today shows a reminder the day before.">
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
        title="Reminders"
        footer={
          reminders.permission === 'granted'
            ? `${reminders.scheduled} ${reminders.scheduled === 1 ? 'reminder' : 'reminders'} lined up for the next two weeks. ${isMacApp ? 'They arrive while unidash is in the menu bar (closing the window keeps it there).' : 'They arrive even when unidash is closed.'}`
            : undefined
        }
      >
        {reminders.permission === 'granted' && (
          <div className="flex flex-col gap-1">
            <Toggle
              label="Time to leave for class"
              checked={profile.reminders?.leave !== false}
              onChange={(v) => setProfile({ reminders: { ...profile.reminders, leave: v } })}
            />
            <Toggle
              label="Deadlines and exams"
              checked={profile.reminders?.deadlines !== false}
              onChange={(v) => setProfile({ reminders: { ...profile.reminders, deadlines: v } })}
            />
            {profile.pass?.renewDay && (
              <Toggle
                label="Travel pass (the day before)"
                checked={profile.reminders?.pass !== false}
                onChange={(v) => setProfile({ reminders: { ...profile.reminders, pass: v } })}
              />
            )}
          </div>
        )}
        {reminders.permission === 'prompt' && (
          <Button size="sm" variant="primary" className="self-start" onClick={reminders.enable}>
            Turn on reminders
          </Button>
        )}
        {(reminders.permission === 'granted' || reminders.permission === 'prompt') && (
          <Button
            size="sm"
            className="self-start"
            onClick={async () => {
              await reminders.test()
              notify('Test sent. It arrives in 5 seconds.')
            }}
          >
            Send test notification
          </Button>
        )}
        {reminders.permission === 'denied' && (
          <p className="px-1 text-subhead text-muted">Notifications are switched off for unidash in the iPhone's Settings app, under unidash.</p>
        )}
        <p className="px-1 text-subhead text-muted">
          Ten minutes before it's time to leave for your first class, the evening before and three hours before anything is due{profile.pass?.renewDay ? ', and at 10:00 the day before your travel pass runs out' : ''}.
        </p>
      </FormGroup>
      )}

      <div ref={calendarSection} className="scroll-mt-4">
        <FormGroup
          title="Google account"
          footer="Signing in on every device keeps your courses, deadlines, events and tasks the same everywhere. unidash stores them in a private folder in your own Google Drive that only unidash can see, and only reads your calendar. There is no unidash server."
        >
          {calendar.google.account ? (
            <div className="surface flex items-center gap-3 px-4 py-3">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-headline text-accent">
                {(calendar.google.account.name ?? calendar.google.account.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-ink">{calendar.google.account.name ?? 'Google account'}</span>
                <span className="block truncate text-subhead text-muted">{calendar.google.account.email}</span>
              </span>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  await calendar.google.disconnect()
                  notify('Google Calendar disconnected')
                }}
              >
                Disconnect
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
                  notify('Google Calendar connected')
                } catch (e) {
                  notify(e instanceof Error && /cancel|closed/i.test(e.message) ? 'Sign-in cancelled' : 'Couldn’t connect to Google. Try again.', 'error')
                }
              }}
            >
              {calendar.google.connecting ? 'Waiting for Google…' : 'Connect with Google'}
            </Button>
          ) : (
            <p className="px-1 text-subhead text-muted">Google sign-in isn’t switched on yet. For now, import an .ics file below.</p>
          )}
          {calendar.google.account && (
            <div className="surface flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-body font-medium text-ink">Sync across devices</span>
                <span className={`block text-subhead ${cloud.status === 'error' || cloud.status === 'paused' ? 'text-danger' : 'text-muted'}`}>
                  {cloud.status === 'syncing'
                    ? 'Syncing…'
                    : cloud.status === 'paused' || cloud.status === 'error'
                      ? cloud.error
                      : cloud.lastSyncedAt
                        ? `Up to date, synced ${countdown(new Date(cloud.lastSyncedAt)).replace('today', 'just now')}`
                        : 'Waiting for the first sync'}
                </span>
              </span>
              {cloud.status === 'paused' ? (
                <Button size="sm" variant="primary" onClick={() => calendar.google.connect().then(cloud.syncNow).catch(() => {})}>
                  Reconnect
                </Button>
              ) : (
                <Button size="sm" onClick={cloud.syncNow} disabled={cloud.status === 'syncing'}>
                  Sync now
                </Button>
              )}
            </div>
          )}
          {calendar.status === 'reconnect' && calendar.google.account && (
            <Button size="sm" variant="primary" onClick={() => calendar.google.connect().catch(() => {})} className="self-start">
              Reconnect
            </Button>
          )}
          {calendar.status !== 'off' && (
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="min-w-0 text-subhead text-muted">
                {calendar.status === 'syncing'
                  ? 'Syncing…'
                  : calendar.syncedAt
                    ? `${calendar.events.length} upcoming events, synced ${countdown(new Date(calendar.syncedAt)).replace('today', 'just now')}.`
                    : 'Not synced yet.'}
              </p>
              <Button size="sm" onClick={calendar.sync} disabled={calendar.status === 'syncing'}>
                Sync now
              </Button>
            </div>
          )}
          {calendar.status === 'error' && <p className="px-1 text-subhead text-danger">{calendar.error}</p>}

          {isNative && (
          <details className="group">
            <summary className="cursor-pointer list-none px-1 text-subhead font-medium text-accent [&::-webkit-details-marker]:hidden">
              Use an iCal link instead
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <ol className="list-decimal space-y-1 pl-6 text-subhead text-muted">
                <li>On a computer, open Google Calendar → Settings.</li>
                <li>Pick a calendar, then “Integrate calendar”.</li>
                <li>Copy “Secret address in iCal format”, then tap below.</li>
              </ol>
              <Button onClick={pasteAndConnect} className="w-full">
                Paste link and connect
              </Button>
              <TextArea
                value={calendarText}
                onChange={(e) => setCalendarText(e.target.value)}
                rows={3}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                aria-label="Calendar addresses, one per line"
                className="break-all"
              />
              <Button size="sm" onClick={() => connect(calendarText)} className="self-start">
                {profile.calendarUrls?.length ? 'Save addresses' : 'Connect typed address'}
              </Button>
            </div>
          </details>
          )}
        </FormGroup>
      </div>

      <FormGroup title="Import" footer="Importing the same file again updates those events instead of duplicating them.">
        <p className="px-1 text-subhead text-muted">Add events from an .ics file, such as an Apple Calendar export or your school portal.</p>
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
          Choose .ics file
        </Button>
      </FormGroup>

      <FormGroup title="Data" footer={calendar.google.account ? 'Stored on this device and in your own Google Drive. Nothing goes to a unidash server.' : 'Stored on this device only. Nothing goes to a unidash server.'}>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (courses.items.length && !confirm('Replace your courses, deadlines, events and tasks with sample data?')) return
              loadSample()
              notify('Sample data loaded')
              onDone()
            }}
          >
            Load sample data
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (!confirm('Delete all courses, deadlines, events and tasks on this device?')) return
              clearAll()
              notify('All data deleted')
              onDone()
            }}
          >
            Delete all data
          </Button>
        </div>
      </FormGroup>

      <FormGroup
        title="About"
        footer={isNative ? 'The app downloads new versions from the website by itself and switches to them the next time you open it.' : undefined}
      >
        <p className="px-1 text-subhead text-muted">
          Version <span className="font-medium text-ink tabular-nums">{BUILD}</span> · built{' '}
          {BUILT_AT.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        <Button
          size="sm"
          className="self-start"
          onClick={() => {
            setProfile({ onboarded: false })
            onDone()
          }}
        >
          Run setup again
        </Button>
      </FormGroup>
    </div>
  )
}
