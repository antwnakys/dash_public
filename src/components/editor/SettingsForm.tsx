import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { useDashboard } from '@/context/DashboardContext'
import { searchPlace } from '@/data/weather'
import { countdown } from '@/lib/date'
import { parseIcs } from '@/lib/ics'
import { COMMUTE_ROUTE, DEFAULT_COMMUTE, DEFAULT_TRAINS, parseTrainTimes } from '@/lib/commute'
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
  const { profile, setProfile, events, courses, calendar, cloud, reminders, location, appExpires, loadSample, clearAll, theme, notify } = useDashboard()
  const [calendarText, setCalendarText] = useState((profile.calendarUrls ?? []).join('\n'))
  const [name, setName] = useState(profile.name)
  const [city, setCity] = useState(profile.place?.name ?? '')
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
      setProfile({ name: name.trim(), place })
      notify('Settings saved')
      onDone()
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
          <Toggle
            label="Update my location when I open dash"
            checked={profile.autoLocation !== false}
            onChange={(v) => setProfile({ autoLocation: v })}
          />
          {profile.autoLocation !== false && (
            <p className="-mt-1 px-1 text-subhead text-muted">
              {location.denied
                ? 'Location is off for dash, so the weather uses the city below. Allow location for dash to follow where you are.'
                : location.here
                  ? `Weather for where you are: ${location.here.name}. This device only.`
                  : 'Finding where you are…'}
            </p>
          )}
          <Field label={profile.autoLocation !== false ? 'City when your location isn’t available' : 'Weather location'}>
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
          title="Getting to campus"
          footer={`${COMMUTE_ROUTE}. Today shows when to leave for your first class; in the evening, for tomorrow's.`}
        >
          <Field
            label="Suburban trains you take"
            hint="From Doukissis Plakentias to Pentelis. dash picks the latest one that gets you to class on time."
          >
            <TextInput
              defaultValue={(profile.suburbanTrains ?? DEFAULT_TRAINS).join(', ')}
              inputMode="numeric"
              placeholder="17:11, 17:32, 17:50"
              onBlur={(e) => {
                const times = parseTrainTimes(e.target.value)
                e.target.value = times.join(', ')
                if (times.join() !== (profile.suburbanTrains ?? DEFAULT_TRAINS).join()) {
                  setProfile({ suburbanTrains: times })
                  notify('Train times saved')
                }
              }}
            />
          </Field>
          <Field label="Door to door, when no train fits">
            <Select
              value={profile.commuteMinutes ?? DEFAULT_COMMUTE}
              onChange={(e) => {
                setProfile({ commuteMinutes: +e.target.value })
                notify('Travel time saved')
              }}
            >
              {Array.from({ length: 27 }, (_, i) => 20 + i * 5).map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`}
                </option>
              ))}
            </Select>
          </Field>
        </FormGroup>
      </div>

      <FormGroup
        title="Reminders"
        footer={
          reminders.permission === 'granted'
            ? `${reminders.scheduled} ${reminders.scheduled === 1 ? 'reminder' : 'reminders'} lined up for the next two weeks. ${isMacApp ? 'They arrive while dash is in the menu bar (closing the window keeps it there).' : 'They arrive even when dash is closed.'}`
            : reminders.permission === 'unavailable'
              ? 'Reminders work in the dash iPhone and Mac apps.'
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
            {appExpires && (
              <Toggle
                label="Before the app stops opening"
                checked={profile.reminders?.appExpiry !== false}
                onChange={(v) => setProfile({ reminders: { ...profile.reminders, appExpiry: v } })}
              />
            )}
            <Toggle
              label="Metro card (2nd of each month)"
              checked={profile.reminders?.metroCard !== false}
              onChange={(v) => setProfile({ reminders: { ...profile.reminders, metroCard: v } })}
            />
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
          <p className="px-1 text-subhead text-muted">Notifications are switched off for dash in the iPhone's Settings app, under dash.</p>
        )}
        <p className="px-1 text-subhead text-muted">
          Ten minutes before it's time to leave for your first class, the evening before and three hours before anything is due, and at 10:00 on the 2nd of each month for your metro card.
        </p>
      </FormGroup>

      <div ref={calendarSection} className="scroll-mt-4">
        <FormGroup
          title="Google account"
          footer="Signing in on every device keeps your courses, deadlines, events and tasks the same everywhere. dash stores them in a private folder in your Google Drive that only dash can see, and only reads your calendar."
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
            <p className="px-1 text-subhead text-muted">Google sign-in isn’t set up in this build yet. Use an iCal link below.</p>
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
              <p className="px-1 text-caption text-faint">iCal links sync in the iPhone app; browsers block them.</p>
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

      <FormGroup title="Data" footer="Everything is stored on this device only.">
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
        {appExpires && (
          <p className="px-1 text-subhead text-muted">
            App signed until{' '}
            <span className="font-medium text-ink">{appExpires.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            . Reinstall from the Mac before then.
          </p>
        )}
      </FormGroup>
    </div>
  )
}
