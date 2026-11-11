import { Logo } from '@/components/brand/Logo'
import { lang, languages, locale, setLanguage, t, type Key, type LangCode } from '@/i18n'

/** When the policy last changed (shown on the page; bump it with every change to the text). */
const UPDATED = new Date(2026, 10, 11)

function Section({ title, children }: { title: Key; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-title text-ink">{t(title)}</h2>
      {children}
    </section>
  )
}

const P = ({ k }: { k: Key }) => <p className="text-body text-muted">{t(k)}</p>

function List({ items }: { items: Key[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 ps-5 text-body text-muted marker:text-faint">
      {items.map((k) => (
        <li key={k}>{t(k)}</li>
      ))}
    </ul>
  )
}

/** The public privacy policy (privacy.html), in the visitor's language: the link Google and Apple ask for. */
export function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-16 sm:px-6 sm:pt-12">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <a href="./" className="flex items-center gap-2 text-headline text-ink">
            <Logo className="size-8" />
            unidash
          </a>
          <label className="flex items-center gap-2 text-subhead text-muted">
            <span className="sr-only">{t('pp.language')}</span>
            <select
              value={lang}
              onChange={(e) => setLanguage(e.target.value as LangCode)}
              className="rounded-full bg-fill px-3 py-1.5 text-subhead text-ink outline-none"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <h1 className="text-large-title text-ink">{t('pp.title')}</h1>
        <p className="text-subhead text-faint">{t('pp.updated', { date: UPDATED.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
        <p className="text-body text-ink">{t('pp.intro')}</p>
      </header>

      <Section title="pp.storeTitle">
        <P k="pp.store" />
        <P k="pp.files" />
      </Section>
      <Section title="pp.googleTitle">
        <P k="pp.google1" />
        <List items={['pp.googleCal', 'pp.googleDrive']} />
        <P k="pp.google2" />
        <p className="surface px-4 py-3 text-body text-ink">{t('pp.limitedUse')}</p>
      </Section>
      <Section title="pp.servicesTitle">
        <P k="pp.services" />
        <List items={['pp.svcWeather', 'pp.svcMap', 'pp.svcPhoton', 'pp.svcPlace', 'pp.svcGoogle', 'pp.svcHost']} />
      </Section>
      <Section title="pp.locationTitle">
        <P k="pp.location" />
      </Section>
      <Section title="pp.remindersTitle">
        <P k="pp.reminders" />
      </Section>
      <Section title="pp.deleteTitle">
        <List items={['pp.delete1', 'pp.delete2', 'pp.delete3']} />
      </Section>
      <Section title="pp.childrenTitle">
        <P k="pp.children" />
      </Section>
      <Section title="pp.changesTitle">
        <P k="pp.changes" />
      </Section>
      <Section title="pp.contactTitle">
        <P k="pp.contact" />
        <a href="https://github.com/antwnakys/dash_public/issues" className="text-body font-medium text-accent" target="_blank" rel="noreferrer">
          {t('pp.contactLink')}
        </a>
      </Section>
      {lang !== 'en' && <p className="text-caption text-faint">{t('pp.translationNote')}</p>}
      <a href="./" className="self-start rounded-full bg-accent-fill px-4 py-2.5 text-body font-semibold text-accent-ink">
        {t('pp.back')}
      </a>
    </main>
  )
}
