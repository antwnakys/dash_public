import { AnimatePresence, motion } from 'framer-motion'
import { Bike, Car, ChevronLeft, Footprints, TrainFront } from 'lucide-react'
import { Children, useState, type FormEvent, type ReactNode } from 'react'
import { Logo } from '@/components/brand/Logo'
import { Field, Select, TextInput } from '@/components/editor/fields'
import { Button } from '@/components/ui/Button'
import { useDashboard } from '@/context/DashboardContext'
import { cn } from '@/lib/cn'
import { blur, ease, ltr, press, spring } from '@/lib/motion'
import { dayLabel, lookUp, minuteOptions, minutesLabel, passDays } from '@/lib/setup'
import type { CommuteMode, Place } from '@/types'
import { SchoolPicker } from '@/components/place/SchoolPicker'
import { t } from '@/i18n'

type Step = 'welcome' | 'name' | 'school' | 'home' | 'mode' | 'minutes' | 'pass' | 'done'

const modeChoices: Array<{ value: CommuteMode; label: string; icon: typeof Car }> = [
  { value: 'transit', label: t('ob.transit'), icon: TrainFront },
  { value: 'car', label: t('ob.car'), icon: Car },
  { value: 'walk', label: t('ob.walk'), icon: Footprints },
  { value: 'bike', label: t('ob.bike'), icon: Bike },
]

// Each screen's parts arrive one after another (title, then the explanation, then fields, then buttons).
// The step container drives them through the 'enter' → 'center' variants.
const rise = {
  enter: { opacity: 0, y: 16, ...blur(4) },
  center: { opacity: 1, y: 0, ...blur(0), transition: { ...spring.gentle, opacity: { duration: 0.35 } } },
}
const stagger = (delay = 0.08) => ({ enter: {}, center: { transition: { staggerChildren: 0.065, delayChildren: delay } } })

function Rise({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={rise} className={className}>
      {children}
    </motion.div>
  )
}

function Screen({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <motion.div variants={stagger()} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Rise>
          <h1 className="text-large-title text-ink">{title}</h1>
        </Rise>
        {lead && (
          <Rise>
            <p className="text-body text-muted">{lead}</p>
          </Rise>
        )}
      </div>
      {Children.map(children, (child) => child && <Rise>{child}</Rise>)}
    </motion.div>
  )
}

/** A choice tile that sinks when pressed and rings in blue when picked. */
function Choice({ selected, onClick, children, className }: { selected: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <motion.button
      type="button"
      variants={rise}
      whileTap={press}
      onClick={onClick}
      aria-pressed={selected}
      className={cn('surface relative text-start hover:bg-fill/60', className)}
    >
      <AnimatePresence>
        {selected && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-accent"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.snappy}
          />
        )}
      </AnimatePresence>
      {children}
    </motion.button>
  )
}

/** The last screen's moment: a check that pops in, draws itself, and sends out a little burst. */
function Celebration() {
  const dots = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2)
  return (
    <div aria-hidden className="relative flex size-24 items-center justify-center">
      {dots.map((a, i) => (
        <motion.span
          key={i}
          className={cn('absolute size-2 rounded-full', i % 2 ? 'bg-course' : 'bg-accent')}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{ x: Math.cos(a) * 62, y: Math.sin(a) * 62, scale: [0, 1.2, 0], opacity: [1, 1, 0] }}
          transition={{ duration: 0.8, delay: 0.32, ease: ease.out, times: [0, 0.4, 1] }}
        />
      ))}
      <motion.span
        className="absolute inset-2 rounded-full bg-accent-fill"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...spring.bouncy, delay: 0.1 }}
      />
      <svg viewBox="0 0 24 24" className="relative size-10">
        <motion.path
          d="M6 12.5l4 4 8-9"
          fill="none"
          stroke="var(--accent-ink)"
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.3, ease: ease.out }}
        />
      </svg>
    </div>
  )
}

/** Continue, and Skip for now. */
function Actions({ busy, onSkip }: { busy?: boolean; onSkip?: () => void }) {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <Button type="submit" variant="primary" className="h-12 w-full text-headline" disabled={busy}>
        {busy ? t('ob.lookingUp') : t('ob.continue')}
      </Button>
      {onSkip && (
        <Button variant="plain" className="h-11 w-full" onClick={onSkip} disabled={busy}>
          {t('ob.skip')}
        </Button>
      )}
    </div>
  )
}

/**
 * First open: a few calm questions, one per screen (name, school, home, how you get there, travel pass).
 * Everything can be skipped and changed later in Settings. AppShell shows it until `profile.onboarded`.
 */
// The setup can only be on screen at page load the first time it's shown.
let shownBefore = false

export function Onboarding() {
  const [firstShow] = useState(() => {
    const first = !shownBefore && performance.now() < 3000
    shownBefore = true
    return first
  })
  const { profile, setProfile, calendar, notify } = useDashboard()
  const [step, setStep] = useState<Step>('welcome')
  const [back, setBack] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState(profile.name)
  const [schoolName, setSchoolName] = useState(profile.school?.name ?? '')
  const [address, setAddress] = useState(profile.school?.address ?? '')
  const [schoolPlace, setSchoolPlace] = useState<Place | undefined>(profile.school?.place)
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
      const { place } = schoolPlace && a ? { place: schoolPlace } : await lookUp(a, { text: profile.school?.address, place: profile.school?.place })
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
      if (!found) return setError(t('ob.homeNotFound', { name: h }))
      setProfile({ home: place })
      next()
    } catch {
      setError(t('ob.mapFailed'))
    } finally {
      setBusy(false)
    }
  }

  const connectGoogle = async () => {
    try {
      await calendar.google.connect()
      // Sync brings the profile from the other device; if it was set up there, this screen closes by itself.
      notify(t('ob.signedIn'))
    } catch (e) {
      notify(e instanceof Error && /cancel|closed/i.test(e.message) ? t('google.cancelled') : t('google.connectFailed'), 'error')
    }
  }

  let body: ReactNode
  switch (step) {
    case 'welcome':
      body = (
        // The logo draws itself first; the words and buttons follow once it's done.
        <motion.div variants={stagger(0.75)} className="flex flex-col items-center gap-6 text-center">
          <Logo animated className="size-20" />
          <Rise className="flex flex-col gap-2">
            <h1 className="text-large-title text-ink">{t('ob.welcome')}</h1>
            <p className="text-body text-muted">{t('ob.welcomeLead')}</p>
          </Rise>
          <Rise className="flex w-full flex-col gap-2 pt-2">
            <Button variant="primary" className="h-12 w-full text-headline" onClick={next}>
              {t('ob.start')}
            </Button>
            {calendar.google.available && !calendar.google.account && (
              <Button className="h-11 w-full" onClick={connectGoogle} disabled={calendar.google.connecting}>
                {calendar.google.connecting ? t('google.waiting') : t('ob.signIn')}
              </Button>
            )}
            <Button variant="plain" className="h-11 w-full" onClick={finish}>
              {t('ob.skipSetup')}
            </Button>
          </Rise>
          <Rise>
            <p className="text-caption text-faint">
              {calendar.google.available ? t('ob.privacyGoogle') : t('ob.privacy')}{' '}
              <a href="./privacy.html" target="_blank" rel="noreferrer" className="font-medium text-accent">
                {t('ob.privacyLink')}
              </a>
            </p>
          </Rise>
        </motion.div>
      )
      break
    case 'name':
      body = (
        <form onSubmit={submit(() => (setProfile({ name: name.trim() }), next()))}>
          <Screen title={t('ob.name')} lead={t('ob.nameLead')}>
            <Field label={t('ob.firstName')}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus placeholder={t('ob.namePh')} />
            </Field>
            <Actions onSkip={next} />
          </Screen>
        </form>
      )
      break
    case 'school':
      body = (
        <form onSubmit={submit(saveSchool)}>
          <Screen title={t('ob.school')} lead={t('ob.schoolLead')}>
            <SchoolPicker
              autoFocus
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
            <Field label={t('ob.schoolName')}>
              <TextInput value={schoolName} onChange={(e) => setSchoolName(e.target.value)} autoComplete="organization" placeholder={t('ob.schoolPh')} />
            </Field>
            <Field label={t('ob.address')} hint={t('ob.addressHint')}>
              <TextInput value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" placeholder={t('set.addressPh')} />
            </Field>
            <Actions busy={busy} onSkip={next} />
          </Screen>
        </form>
      )
      break
    case 'home':
      body = (
        <form onSubmit={submit(saveHome)}>
          <Screen title={t('ob.home')} lead={t('ob.homeLead')}>
            <Field label={t('ob.homeField')}>
              <TextInput value={home} onChange={(e) => setHome(e.target.value)} autoComplete="off" placeholder={t('ob.homePh')} autoFocus />
            </Field>
            {error && (
              <motion.p
                key={error}
                initial={{ x: 0 }}
                animate={{ x: [0, -8, 7, -5, 3, 0] }}
                transition={{ duration: 0.45, ease: ease.out }}
                className="px-1 text-subhead text-danger"
              >
                {error}
              </motion.p>
            )}
            <Actions busy={busy} onSkip={next} />
          </Screen>
        </form>
      )
      break
    case 'mode':
      body = (
        <Screen title={t('ob.mode')}>
          <motion.div variants={stagger(0)} className="grid grid-cols-2 gap-3">
            {modeChoices.map(({ value, label, icon: Icon }) => (
              <Choice
                key={value}
                selected={mode === value}
                onClick={() => {
                  setProfile({ commute: { ...profile.commute, mode: value } })
                  // A beat to see the choice light up before moving on.
                  window.setTimeout(() => go('minutes'), 180)
                }}
                className="flex flex-col items-start gap-3 px-4 py-4"
              >
                <Icon aria-hidden className="relative size-6 text-accent" strokeWidth={2} />
                <span className="relative text-headline text-ink">{label}</span>
              </Choice>
            ))}
          </motion.div>
          <Button variant="plain" className="h-11 w-full" onClick={() => go('done')}>
            {t('ob.skip')}
          </Button>
        </Screen>
      )
      break
    case 'minutes':
      body = (
        <form onSubmit={submit(() => (setProfile({ commute: { ...profile.commute, minutes } }), next()))}>
          <Screen title={t('ob.minutes')} lead={t('ob.minutesLead')}>
            <Field label={t('set.doorToDoor')}>
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
          <Screen title={t('ob.pass')} lead={t('ob.passLead')}>
            <motion.div variants={stagger(0)} className="grid grid-cols-2 gap-3">
              {[
                { value: true, label: t('ob.yes') },
                { value: false, label: t('ob.no') },
              ].map((o) => (
                <Choice key={o.label} selected={hasPass === o.value} onClick={() => setHasPass(o.value)} className="h-12 text-center text-headline text-ink">
                  <span className="relative">{o.label}</span>
                </Choice>
              ))}
            </motion.div>
            <AnimatePresence initial={false}>
              {hasPass && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={spring.smooth}
                  className="-m-1 overflow-hidden p-1"
                >
                  <Field label={t('set.passDay')}>
                    <Select value={passDay} onChange={(e) => setPassDay(+e.target.value)}>
                      {passDays.map((d) => (
                        <option key={d} value={d}>
                          {dayLabel(d)} of each month
                        </option>
                      ))}
                    </Select>
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
            <Actions onSkip={next} />
          </Screen>
        </form>
      )
      break
    case 'done':
      body = (
        <motion.div variants={stagger(0.5)} className="flex flex-col items-center gap-6 text-center">
          <Celebration />
          <Rise className="flex flex-col gap-2">
            <h1 className="text-large-title text-ink">{profile.name ? t('ob.doneName', { name: profile.name }) : t('ob.done')}</h1>
            <p className="text-body text-muted">{t('ob.doneLead')}</p>
          </Rise>
          <Rise className="w-full">
            <Button variant="primary" className="h-12 w-full text-headline" onClick={finish}>
              {t('ob.open')}
            </Button>
          </Rise>
        </motion.div>
      )
      break
  }

  return (
    <motion.div
      role="dialog"
      aria-modal
      aria-label={t('ob.dialog')}
      // On first load the setup is simply there (fading in would flash the app behind it);
      // "Run setup again" fades it in over the app.
      initial={{ opacity: firstShow ? 1 : 0 }}
      animate={{ opacity: 1 }}
      // Closing: the setup lifts away and fades while Today rises in underneath.
      exit={{ opacity: 0, scale: 1.04, ...blur(8), transition: { duration: 0.4, ease: ease.out } }}
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6">
        <div className="flex h-11 items-center justify-between">
          {index > 0 && step !== 'done' ? (
            <Button variant="plain" size="sm" className="-ms-2" onClick={prev} aria-label={t('ob.back')}>
              <ChevronLeft aria-hidden className="size-4" strokeWidth={2.4} />
              {t('ob.back')}
            </Button>
          ) : (
            <span />
          )}
          <AnimatePresence>
            {step !== 'welcome' && step !== 'done' && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0, scaleX: 0.6 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0 }}
                transition={spring.smooth}
                className="h-1.5 w-28 overflow-hidden rounded-full bg-fill-strong"
              >
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={false}
                  animate={{ width: `${(index / (order.length - 2)) * 100}%` }}
                  transition={spring.smooth}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <span className="w-12" />
        </div>
        <div className="flex flex-1 flex-col justify-center py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={{
                enter: { opacity: 0, x: (back ? -40 : 40) * ltr },
                center: { opacity: 1, x: 0, transition: { x: spring.smooth, opacity: { duration: 0.2 } } },
                exit: { opacity: 0, x: (back ? 40 : -40) * ltr, transition: { x: spring.smooth, opacity: { duration: 0.14 } } },
              }}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {body}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
