import { AnimatePresence, motion } from 'framer-motion'
import { Bike, Car, ChevronLeft, Footprints, TrainFront } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Logo } from '@/components/brand/Logo'
import { Field, Select, TextInput } from '@/components/editor/fields'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { cn } from '@/lib/cn'
import { dayLabel, lookUp, minuteOptions, minutesLabel, passDays } from '@/lib/setup'
import type { CommuteMode } from '@/types'

type Step = 'welcome' | 'name' | 'school' | 'home' | 'mode' | 'minutes' | 'pass' | 'done'

const modeChoices: Array<{ value: CommuteMode; label: string; icon: typeof Car }> = [
  { value: 'transit', label: 'Bus, metro or train', icon: TrainFront },
  { value: 'car', label: 'Car', icon: Car },
  { value: 'walk', label: 'On foot', icon: Footprints },
  { value: 'bike', label: 'Bike or scooter', icon: Bike },
]

function Screen({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-large-title text-ink">{title}</h1>
        {lead && <p className="text-body text-muted">{lead}</p>}
      </div>
      {children}
    </div>
  )
}

/** Continue, and Skip for now. */
function Actions({ busy, onSkip }: { busy?: boolean; onSkip?: () => void }) {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <Button type="submit" variant="primary" className="h-12 w-full text-headline" disabled={busy}>
        {busy ? 'Looking it up…' : 'Continue'}
      </Button>
      {onSkip && (
        <Button variant="plain" className="h-11 w-full" onClick={onSkip} disabled={busy}>
          Skip for now
        </Button>
      )}
    </div>
  )
}

/**
 * First open: a few calm questions, one per screen (name, school, home, how you get there, travel pass).
 * Everything can be skipped and changed later in Settings. AppShell shows it until `profile.onboarded`.
 */
export function Onboarding() {
  const { profile, setProfile, calendar, notify } = useDashboard()
  const [step, setStep] = useState<Step>('welcome')
  const [back, setBack] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState(profile.name)
  const [schoolName, setSchoolName] = useState(profile.school?.name ?? '')
  const [address, setAddress] = useState(profile.school?.address ?? '')
  const [home, setHome] = useState(profile.home?.name ?? '')
  const [minutes, setMinutes] = useState(profile.commute?.minutes ?? 30)
  const [hasPass, setHasPass] = useState(Boolean(profile.pass?.renewDay))
  const [passDay, setPassDay] = useState(profile.pass?.renewDay ?? 1)

  const mode = profile.commute?.mode
  const order: Step[] = ['welcome', 'name', 'school', 'home', 'mode', 'minutes', ...(mode === 'transit' || !mode ? (['pass'] as const) : []), 'done']
  const index = order.indexOf(step)
  const go = (to: Step, backwards = false) => {
    setError('')
    setBack(backwards)
    setStep(to)
  }
  const next = () => go(order[Math.min(index + 1, order.length - 1)])
  const prev = () => index > 0 && go(order[index - 1], true)
  const finish = () => setProfile({ onboarded: true })
  const submit = (fn: () => void | Promise<void>) => async (e: FormEvent) => {
    e.preventDefault()
    await fn()
  }

  const saveSchool = async () => {
    const n = schoolName.trim()
    const a = address.trim()
    if (!n && !a) {
      setProfile({ school: undefined })
      return next()
    }
    setBusy(true)
    try {
      const { place } = await lookUp(a, { text: profile.school?.address, place: profile.school?.place })
      setProfile({ school: { name: n || undefined, address: a || undefined, place } })
    } catch {
      // Offline: keep the address for matching classes; the map lookup happens next time it's saved.
      setProfile({ school: { name: n || undefined, address: a || undefined } })
    } finally {
      setBusy(false)
    }
    next()
  }

  const saveHome = async () => {
    const h = home.trim()
    if (!h) {
      setProfile({ home: undefined })
      return next()
    }
    if (h === profile.home?.name) return next()
    setBusy(true)
    try {
      const { place, found } = await lookUp(h)
      if (!found) return setError(`Couldn’t find “${h}” on the map. Try a neighbourhood and city, like “Kifisia, Athens”.`)
      setProfile({ home: place })
      next()
    } catch {
      setError('Couldn’t reach the map service. Check your connection, or skip this for now.')
    } finally {
      setBusy(false)
    }
  }

  const connectGoogle = async () => {
    try {
      await calendar.google.connect()
      // Sync brings the profile from the other device; if it was set up there, this screen closes by itself.
      notify('Signed in. Your data is on its way.')
    } catch (e) {
      notify(e instanceof Error && /cancel|closed/i.test(e.message) ? 'Sign-in cancelled' : 'Couldn’t connect to Google. Try again.', 'error')
    }
  }

  let body: ReactNode
  switch (step) {
    case 'welcome':
      body = (
        <div className="flex flex-col items-center gap-6 text-center">
          <Logo animated className="size-20" />
          <div className="flex flex-col gap-2">
            <h1 className="text-large-title text-ink">Welcome to unidash</h1>
            <p className="text-body text-muted">Your classes, deadlines, exams and calendar in one calm place. A few quick questions to set it up; skip any of them.</p>
          </div>
          <div className="flex w-full flex-col gap-2 pt-2">
            <Button variant="primary" className="h-12 w-full text-headline" onClick={next}>
              Get started
            </Button>
            {calendar.google.available && !calendar.google.account && (
              <Button className="h-11 w-full" onClick={connectGoogle} disabled={calendar.google.connecting}>
                {calendar.google.connecting ? 'Waiting for Google…' : 'I already use unidash: sign in with Google'}
              </Button>
            )}
            <Button variant="plain" className="h-11 w-full" onClick={finish}>
              Skip setup
            </Button>
          </div>
          <p className="text-caption text-faint">Everything stays on this device{calendar.google.available ? ' and, if you sign in, in your own Google Drive' : ''}. There’s no unidash server.</p>
        </div>
      )
      break
    case 'name':
      body = (
        <form onSubmit={submit(() => (setProfile({ name: name.trim() }), next()))}>
          <Screen title="What’s your name?" lead="Just for the greeting.">
            <Field label="First name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus placeholder="Your name" />
            </Field>
            <Actions onSkip={next} />
          </Screen>
        </form>
      )
      break
    case 'school':
      body = (
        <form onSubmit={submit(saveSchool)}>
          <Screen title="Where do you study?" lead="Events in your calendar at this address count as classes, and Today tells you when to leave for them.">
            <Field label="School (optional)">
              <TextInput value={schoolName} onChange={(e) => setSchoolName(e.target.value)} autoComplete="organization" placeholder="University of Piraeus" autoFocus />
            </Field>
            <Field label="Address" hint="Street and number, the way it appears in your calendar events.">
              <TextInput value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" placeholder="Street 12, Area" />
            </Field>
            <Actions busy={busy} onSkip={next} />
          </Screen>
        </form>
      )
      break
    case 'home':
      body = (
        <form onSubmit={submit(saveHome)}>
          <Screen title="Where do you live?" lead="A neighbourhood is enough. It’s used for the weather on your way to class.">
            <Field label="Neighbourhood and city">
              <TextInput value={home} onChange={(e) => setHome(e.target.value)} autoComplete="off" placeholder="Kifisia, Athens" autoFocus />
            </Field>
            {error && <p className="px-1 text-subhead text-danger">{error}</p>}
            <Actions busy={busy} onSkip={next} />
          </Screen>
        </form>
      )
      break
    case 'mode':
      body = (
        <Screen title="How do you get to school?">
          <div className="grid grid-cols-2 gap-3">
            {modeChoices.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setProfile({ commute: { ...profile.commute, mode: value } })
                  go('minutes')
                }}
                aria-pressed={mode === value}
                className={cn(
                  'surface flex flex-col items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-fill/60',
                  mode === value && 'ring-2 ring-accent',
                )}
              >
                <Icon aria-hidden className="size-6 text-accent" strokeWidth={2} />
                <span className="text-headline text-ink">{label}</span>
              </button>
            ))}
          </div>
          <Button variant="plain" className="h-11 w-full" onClick={() => go('done')}>
            Skip for now
          </Button>
        </Screen>
      )
      break
    case 'minutes':
      body = (
        <form onSubmit={submit(() => (setProfile({ commute: { ...profile.commute, minutes } }), next()))}>
          <Screen title="About how long does it take?" lead="Door to door, on a normal day. Today uses it to say when to leave.">
            <Field label="Door to door">
              <Select value={minutes} onChange={(e) => setMinutes(+e.target.value)}>
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>
                    {minutesLabel(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Actions onSkip={next} />
          </Screen>
        </form>
      )
      break
    case 'pass':
      body = (
        <form onSubmit={submit(() => (setProfile({ pass: hasPass ? { renewDay: passDay } : undefined }), next()))}>
          <Screen title="Do you have a monthly travel pass?" lead="unidash can remind you the day before it runs out.">
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={hasPass === o.value}
                  onClick={() => setHasPass(o.value)}
                  className={cn('surface h-12 text-headline text-ink transition-colors hover:bg-fill/60', hasPass === o.value && 'ring-2 ring-accent')}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {hasPass && (
              <Field label="It runs out on">
                <Select value={passDay} onChange={(e) => setPassDay(+e.target.value)}>
                  {passDays.map((d) => (
                    <option key={d} value={d}>
                      {dayLabel(d)} of each month
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Actions onSkip={next} />
          </Screen>
        </form>
      )
      break
    case 'done':
      body = (
        <div className="flex flex-col items-center gap-6 text-center">
          <Logo className="size-16" />
          <div className="flex flex-col gap-2">
            <h1 className="text-large-title text-ink">{profile.name ? `You’re all set, ${profile.name}` : 'You’re all set'}</h1>
            <p className="text-body text-muted">Add your courses and deadlines with the + button. You can change any of these answers in Settings.</p>
          </div>
          <Button variant="primary" className="h-12 w-full text-headline" onClick={finish}>
            Open unidash
          </Button>
        </div>
      )
      break
  }

  return (
    <motion.div
      role="dialog"
      aria-modal
      aria-label="Set up unidash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6">
        <div className="flex h-11 items-center justify-between">
          {index > 0 && step !== 'done' ? (
            <Button variant="plain" size="sm" className="-ml-2" onClick={prev} aria-label="Back">
              <ChevronLeft aria-hidden className="size-4" strokeWidth={2.4} />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step !== 'welcome' && step !== 'done' && (
            <div aria-hidden className="flex gap-1.5">
              {order.slice(1, -1).map((s, i) => (
                <span key={s} className={cn('h-1.5 rounded-full transition-all', i + 1 <= index ? 'w-5 bg-accent' : 'w-1.5 bg-fill-strong')} />
              ))}
            </div>
          )}
          <span className="w-12" />
        </div>
        <div className="flex flex-1 flex-col justify-center py-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: back ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: back ? 24 : -24 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {body}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
